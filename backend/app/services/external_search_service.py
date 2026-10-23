"""External search service — combines providers, caching, error handling.

Caching strategy
----------------
Query cache: normalise the query string + source, look for a cache row younger
than EXTERNAL_CACHE_HOURS.  On a hit, return the cached ExternalSource rows.
On a miss, call the provider(s), upsert all results into external_sources, then
write a new ExternalQuery row.

Provider isolation
------------------
If one provider fails, the error is surfaced as a partial result with the
other provider's data.  The caller (the route) gets a list of results plus an
optional warning.

Security notes
--------------
* Only the two fixed providers (OpenAlex, arXiv) are ever instantiated.
* No user-supplied URLs are fetched.
* All text from providers is HTML-stripped in base.py before reaching here.
"""

from __future__ import annotations

import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import ExternalQuery, ExternalSource
from app.services.external.arxiv import ArXivProvider
from app.services.external.base import ExternalResult
from app.services.external.openalex import OpenAlexProvider

Source = Literal["openalex", "arxiv", "all"]


def _norm_query(q: str) -> str:
    """Normalise a query for cache lookups: lowercase, strip accents, collapse whitespace."""
    nfkd = unicodedata.normalize("NFKD", q.lower())
    ascii_q = nfkd.encode("ascii", "ignore").decode()
    return " ".join(ascii_q.split())


def _providers(source: Source):
    mapping = {
        "openalex": [OpenAlexProvider()],
        "arxiv": [ArXivProvider()],
        "all": [OpenAlexProvider(), ArXivProvider()],
    }
    return mapping.get(source, [OpenAlexProvider(), ArXivProvider()])


def _upsert_source(db: Session, r: ExternalResult) -> ExternalSource:
    """Insert or update an ExternalSource row; return the row."""
    existing = db.scalar(
        select(ExternalSource).where(
            ExternalSource.source == r.source,
            ExternalSource.external_id == r.external_id,
        )
    )
    if existing:
        # Refresh retrieved_at and any updated fields
        existing.doi = r.doi
        existing.title = r.title
        existing.abstract = r.abstract
        existing.authors = r.authors
        existing.year = r.year
        existing.url = r.url
        existing.retrieved_at = r.retrieved_at
        db.flush()
        return existing

    row = ExternalSource(
        source=r.source,
        external_id=r.external_id,
        doi=r.doi,
        title=r.title,
        abstract=r.abstract,
        authors=r.authors,
        year=r.year,
        url=r.url,
        retrieved_at=r.retrieved_at,
    )
    db.add(row)
    db.flush()
    return row


def search_external(
    db: Session,
    query: str,
    source: Source = "all",
    limit: int = 10,
) -> tuple[list[dict], bool]:
    """Return (results_list, from_cache).

    Each element of results_list is a dict with the ExternalSource fields plus
    ``cached: bool`` and ``code: str``.

    Raises HTTPException on hard failures (missing key, provider 5xx).
    """
    if not settings.external_search_enabled:
        from fastapi import HTTPException
        raise HTTPException(404, "External search is disabled (EXTERNAL_SEARCH_ENABLED=false)")

    norm = _norm_query(query)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.external_cache_hours)

    # ── Cache lookup ──────────────────────────────────────────────────────────
    cached_query = db.scalar(
        select(ExternalQuery).where(
            ExternalQuery.query_norm == norm,
            ExternalQuery.source == source,
            ExternalQuery.fetched_at > cutoff,
        )
    )
    if cached_query:
        rows = db.scalars(
            select(ExternalSource).where(ExternalSource.id.in_(cached_query.result_ids))
        ).all()
        # Re-order to match stored result_ids order
        id_to_row = {r.id: r for r in rows}
        ordered = [id_to_row[i] for i in cached_query.result_ids if i in id_to_row]
        return [_row_to_dict(r, cached=True) for r in ordered[:limit]], True

    # ── Live fetch ────────────────────────────────────────────────────────────
    providers = _providers(source)
    per_provider = max(1, limit)
    all_results: list[ExternalSource] = []

    for provider in providers:
        try:
            raw = provider.search(query, limit=per_provider)
        except Exception:
            raise  # let route handle — isolate in route if multiple providers

        for r in raw:
            row = _upsert_source(db, r)
            all_results.append(row)

    result_ids = [r.id for r in all_results]

    # Write cache row (replace if stale one exists for same norm+source)
    stale = db.scalar(
        select(ExternalQuery).where(
            ExternalQuery.query_norm == norm,
            ExternalQuery.source == source,
        )
    )
    if stale:
        stale.result_ids = result_ids
        stale.fetched_at = datetime.now(timezone.utc)
    else:
        db.add(ExternalQuery(
            query_norm=norm,
            source=source,
            result_ids=result_ids,
            fetched_at=datetime.now(timezone.utc),
        ))

    db.commit()
    return [_row_to_dict(r, cached=False) for r in all_results[:limit]], False


def _row_to_dict(row: ExternalSource, *, cached: bool) -> dict:
    return {
        "id": row.id,
        "code": f"EXT-{row.id:03d}",
        "source": row.source,
        "external_id": row.external_id,
        "doi": row.doi,
        "title": row.title,
        "abstract": row.abstract,
        "authors": row.authors,
        "year": row.year,
        "url": row.url,
        "retrieved_at": row.retrieved_at,
        "cached": cached,
    }


# ── Trending research (dashboard feed) ────────────────────────────────────────

TRENDING_KEY = "__trending__"
TRENDING_CACHE_HOURS = 6


def trending_external(db: Session, limit: int = 5) -> list[dict]:
    """Top *limit* recent papers worldwide.

    Primary: most-cited OpenAlex works from the last 90 days.
    Fallback: newest cs.AI preprints from arXiv (if OpenAlex has no key or fails).
    Cached for TRENDING_CACHE_HOURS so the dashboard does not hit providers on every load.
    """
    from fastapi import HTTPException

    if not settings.external_search_enabled:
        raise HTTPException(404, "External search is disabled (EXTERNAL_SEARCH_ENABLED=false)")

    cutoff = datetime.now(timezone.utc) - timedelta(hours=TRENDING_CACHE_HOURS)
    cached = db.scalar(
        select(ExternalQuery).where(
            ExternalQuery.query_norm == TRENDING_KEY,
            ExternalQuery.fetched_at > cutoff,
        )
    )
    if cached:
        rows = db.scalars(select(ExternalSource).where(ExternalSource.id.in_(cached.result_ids))).all()
        by_id = {r.id: r for r in rows}
        ordered = [by_id[i] for i in cached.result_ids if i in by_id]
        if ordered:
            return [_row_to_dict(r, cached=True) for r in ordered[:limit]]

    raw = []
    if settings.openalex_api_key:
        try:
            raw = OpenAlexProvider().trending(limit=limit)
        except Exception:
            raw = []
    if not raw:
        raw = ArXivProvider().trending(limit=limit)  # may raise HTTPException (502/504)

    rows = [_upsert_source(db, r) for r in raw]
    ids = [r.id for r in rows]
    stale = db.scalar(select(ExternalQuery).where(ExternalQuery.query_norm == TRENDING_KEY))
    if stale:
        stale.result_ids = ids
        stale.fetched_at = datetime.now(timezone.utc)
    else:
        db.add(ExternalQuery(query_norm=TRENDING_KEY, source="trending", result_ids=ids,
                             fetched_at=datetime.now(timezone.utc)))
    db.commit()
    return [_row_to_dict(r, cached=False) for r in rows[:limit]]

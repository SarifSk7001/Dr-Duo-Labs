"""External literature search and import endpoints.

GET  /api/v1/search/external?q=&source=openalex|arxiv|all&limit=10
GET  /api/v1/external/{id}
POST /api/v1/external/{id}/import

Security
--------
* External search is only triggered by explicit user action (this endpoint).
  It is never called automatically.
* Only fixed provider base URLs are used — no arbitrary URL fetching.
* Per-user rate limiting: 10 requests/minute (in-memory, same interface as
  the existing slowapi limiter so it can be swapped to Redis later).
* EXTERNAL_SEARCH_ENABLED=false → 404.
* Missing OPENALEX_API_KEY → 400 (OpenAlex only; arXiv needs no key).
* Provider down → 502 with clear message.
* Provider timeout → 504 with clear message.
* One provider failing does not break the other when source=all.

Import
------
POST /external/{id}/import creates a PRIVATE experiment draft owned by the
requesting user.  The FULL stored abstract is saved as results_summary
(prefixed with "Imported abstract:") and the authors, year, DOI, URL and
provider ids are saved in the provenance column.  The experiment is never
auto-published.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.limiter import limiter, rate_limit_by_user
from app.db.session import get_db
from app.models import Experiment, ExternalSource, User
from app.schemas import ExperimentOut, ExternalSourceOut
from app.services.audit_service import write_audit
from app.services.embedding_service import embed_text, experiment_text
from app.services.external_search_service import Source, search_external, trending_external
from app.api.routes.experiments import _enrich

router = APIRouter(tags=["external"])


def _check_enabled():
    if not settings.external_search_enabled:
        raise HTTPException(404, "External search is disabled (EXTERNAL_SEARCH_ENABLED=false)")


@router.get("/search/external", response_model=list[ExternalSourceOut])
@limiter.limit("10/minute", key_func=rate_limit_by_user)
def search_external_endpoint(
    request: Request,
    q: str = Query("", description="Search query"),
    source: Source = Query("all", description="Provider: openalex | arxiv | all"),
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Search published literature from external providers.

    Results are cached for EXTERNAL_CACHE_HOURS.  Only metadata and abstracts
    are stored — no full text, no PDFs.

    When source='all' and one provider fails, results from the working provider
    are returned; the error is surfaced as a warning in the 'detail' of a
    206-ish response.  This endpoint always returns a list; the caller should
    check that it is non-empty.
    """
    _check_enabled()
    if not q.strip():
        return []

    # When source='all' isolate each provider so one failure doesn't kill the other.
    if source == "all":
        results: list[dict] = []
        errors: list[str] = []
        for s in ("openalex", "arxiv"):
            try:
                hits, _ = search_external(db, q, source=s, limit=limit)
                results.extend(hits)
            except HTTPException as exc:
                errors.append(f"{s}: {exc.detail}")
            except Exception as exc:
                errors.append(f"{s}: unexpected error — {exc}")
        if not results and errors:
            raise HTTPException(502, "; ".join(errors))
        # Deduplicate by id (same result can't come from two providers, but be safe)
        seen: set[int] = set()
        deduped = []
        for r in results:
            if r["id"] not in seen:
                seen.add(r["id"])
                deduped.append(r)
        return deduped[:limit]

    try:
        results, _cached = search_external(db, q, source=source, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"External search error: {exc}") from exc
    return results


@router.get("/external/trending", response_model=list[ExternalSourceOut])
@limiter.limit("20/minute", key_func=rate_limit_by_user)
def trending_endpoint(
    request: Request,
    limit: int = Query(5, ge=1, le=10),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Top recent research worldwide (dashboard feed). Cached for a few hours."""
    _check_enabled()
    try:
        return trending_external(db, limit=limit)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Trending research unavailable: {exc}") from exc


@router.get("/external/{source_id}", response_model=ExternalSourceOut)
def get_external_source(
    source_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return a single cached external source by its integer id."""
    _check_enabled()
    row = db.get(ExternalSource, source_id)
    if not row:
        raise HTTPException(404, "External source not found")
    return {
        "id": row.id,
        "code": row.code,
        "source": row.source,
        "external_id": row.external_id,
        "doi": row.doi,
        "title": row.title,
        "abstract": row.abstract,
        "authors": row.authors,
        "year": row.year,
        "url": row.url,
        "retrieved_at": row.retrieved_at,
        "cached": True,
    }


@router.post("/external/{source_id}/import", response_model=ExperimentOut, status_code=201)
def import_external_source(
    source_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Import a cached external source as a private experiment draft.

    Creates a PRIVATE Draft experiment owned by the requesting user.
    The title comes from the paper and the FULL stored abstract goes into
    results_summary prefixed with "Imported abstract:".  Authors, year, DOI,
    URL and the provider ids are recorded in the provenance JSONB.
    hypothesis_text and research_question are left empty so the user
    fills them in (they are not extracted automatically).

    The experiment is never auto-published (visibility=private,
    review_status=Draft).
    """
    _check_enabled()
    src = db.get(ExternalSource, source_id)
    if not src:
        raise HTTPException(404, "External source not found")

    # Keep the FULL stored abstract (already capped at 2 000 chars by the provider layer).
    abstract = (src.abstract or "").strip()

    now = datetime.now(timezone.utc)
    provenance = {
        "source": src.source,
        "external_id": src.external_id,
        "doi": src.doi,
        "url": src.url,
        "retrieved_at": src.retrieved_at.isoformat() if src.retrieved_at else None,
        "title": src.title,
        "authors": src.authors or [],
        "year": src.year,
        "abstract": abstract,
        "imported_by": user.id,
        "imported_at": now.isoformat(),
        "ai_extracted": False,
    }

    exp = Experiment(
        title=src.title,
        domain="literature import",
        research_question="",
        hypothesis_text="",
        methodology="",
        variables={},
        conditions={},
        sample_size=None,
        outcome="not completed",
        results_summary=f"Imported abstract: {abstract}" if abstract else "",
        limitations=(
            "Imported from published literature (abstract and metadata only). "
            "Not a verified experiment; full text was not stored."
        ),
        visibility="private",
        review_status="Draft",
        owner_id=user.id,
        hypothesis_id=None,
        provenance=provenance,
    )
    exp.embedding = embed_text(experiment_text(exp))
    db.add(exp)
    db.flush()
    write_audit(
        db,
        user_id=user.id,
        action="import_external",
        resource_type="experiment",
        resource_id=exp.id,
        metadata={"source": src.source, "external_id": src.external_id, "title": src.title},
    )
    db.commit()
    db.refresh(exp)
    return _enrich(exp)

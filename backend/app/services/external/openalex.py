"""OpenAlex provider.

API reference: https://docs.openalex.org/api-entities/works/search-works
Base URL: https://api.openalex.org/works   (fixed — no user input)

Authentication
--------------
OpenAlex requires a polite API key (free, sign up at https://openalex.org/):
    ``OPENALEX_API_KEY=your@email.com``
The key is passed as the ``mailto`` query parameter.

Fields fetched (``select`` parameter keeps response small)
----------------------------------------------------------
id, doi, title, abstract_inverted_index, authorships, publication_year,
primary_location

Abstract reconstruction
-----------------------
OpenAlex stores abstracts as an *inverted index* mapping each word to a list
of zero-based positions in the original string.  ``reconstruct_abstract``
rebuilds the plain text by placing every word at its positions.

Rate limits
-----------
OpenAlex allows up to 100 000 calls/day and about 10 req/s for polite pool
(mail address provided).  Application-level per-user rate limiting is
applied upstream; this provider does not implement its own limit.
"""

from __future__ import annotations

import httpx

from app.core.config import settings
from app.services.external.base import ExternalProvider, ExternalResult, truncate

# Fixed base URL — never accept user input for this.
_BASE = "https://api.openalex.org/works"
_FIELDS = "id,doi,title,abstract_inverted_index,authorships,publication_year,primary_location"


def reconstruct_abstract(inverted_index: dict | None) -> str:
    """Rebuild abstract plain text from OpenAlex's inverted index format.

    The inverted index is ``{word: [pos1, pos2, ...], ...}`` where positions
    are zero-based indices in the original token sequence.  We allocate a list
    of the right length, fill in each word, then join with spaces.

    Returns an empty string if the index is absent or malformed.
    """
    if not inverted_index:
        return ""
    # Find the total number of tokens.
    try:
        max_pos = max(p for positions in inverted_index.values() for p in positions)
    except (ValueError, TypeError):
        return ""
    tokens: list[str] = [""] * (max_pos + 1)
    for word, positions in inverted_index.items():
        for pos in positions:
            if 0 <= pos <= max_pos:
                tokens[pos] = word
    return " ".join(tokens).strip()


def parse_works(data: dict) -> list[ExternalResult]:
    """Convert an OpenAlex /works response into ExternalResult objects."""
    results: list[ExternalResult] = []
    for work in data.get("results", []):
        eid = (work.get("id") or "").replace("https://openalex.org/", "")
        doi = work.get("doi")
        if doi:
            doi = doi.replace("https://doi.org/", "")
        title = truncate(work.get("title") or "Untitled", 300)
        abstract = truncate(reconstruct_abstract(work.get("abstract_inverted_index")))
        authors = []
        for a in (work.get("authorships") or [])[:10]:
            auth = a.get("author", {})
            if auth.get("display_name"):
                authors.append(truncate(auth["display_name"], 80))
        year_raw = work.get("publication_year")
        year = int(year_raw) if isinstance(year_raw, (int, float)) else None
        loc = work.get("primary_location") or {}
        landing = loc.get("landing_page_url") or ""
        url = landing or (f"https://doi.org/{doi}" if doi else f"https://openalex.org/{eid}")
        if eid:
            results.append(ExternalResult(
                source="openalex",
                external_id=eid,
                doi=doi,
                title=title,
                abstract=abstract,
                authors=authors,
                year=year,
                url=url,
            ))
    return results


class OpenAlexProvider(ExternalProvider):
    """Fetches scholarly works from the OpenAlex open-access API."""

    def search(self, query: str, limit: int) -> list[ExternalResult]:  # noqa: D102
        api_key = settings.openalex_api_key
        if not api_key:
            from fastapi import HTTPException
            raise HTTPException(
                400,
                "OPENALEX_API_KEY is not set. "
                "Sign up at https://openalex.org and add your email address as OPENALEX_API_KEY in .env.",
            )

        params = {
            "search": query,
            "per_page": min(limit, 20),
            "select": _FIELDS,
            "mailto": api_key,
        }
        headers = {
            "User-Agent": (
                f"ExperimentExchange/1.0 ({settings.external_contact_email}; "
                "mailto:" + api_key + ")"
            )
        }

        try:
            resp = httpx.get(
                _BASE,
                params=params,
                headers=headers,
                timeout=settings.external_timeout_seconds,
                follow_redirects=True,
            )
        except httpx.TimeoutException as exc:
            from fastapi import HTTPException
            raise HTTPException(504, "OpenAlex request timed out") from exc

        if resp.status_code == 429:
            retry = resp.headers.get("Retry-After", "60")
            from fastapi import HTTPException
            raise HTTPException(429, f"OpenAlex rate limit hit. Retry-After: {retry}s")
        if not resp.is_success:
            from fastapi import HTTPException
            raise HTTPException(502, f"OpenAlex returned {resp.status_code}")

        return parse_works(resp.json())

    def trending(self, limit: int = 5, days: int = 90) -> list[ExternalResult]:
        """Most-cited recent works (published in the last *days* days).

        Fixed base URL, no user input.  Requires the same polite-pool email as search().
        """
        from datetime import date, timedelta
        from fastapi import HTTPException

        api_key = settings.openalex_api_key
        if not api_key:
            raise HTTPException(400, "OPENALEX_API_KEY is not set.")
        since = (date.today() - timedelta(days=days)).isoformat()
        params = {
            "per_page": min(limit, 20),
            "select": _FIELDS,
            "mailto": api_key,
            "sort": "cited_by_count:desc",
            "filter": f"from_publication_date:{since},has_abstract:true,type:article",
        }
        headers = {"User-Agent": f"ExperimentExchange/1.0 ({settings.external_contact_email}; mailto:{api_key})"}
        try:
            resp = httpx.get(_BASE, params=params, headers=headers,
                             timeout=settings.external_timeout_seconds, follow_redirects=True)
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "OpenAlex request timed out") from exc
        if resp.status_code == 429:
            raise HTTPException(429, "OpenAlex rate limit hit.")
        if not resp.is_success:
            raise HTTPException(502, f"OpenAlex returned {resp.status_code}")
        return parse_works(resp.json())

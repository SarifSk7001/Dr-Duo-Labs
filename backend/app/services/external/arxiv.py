"""arXiv provider.

API reference: https://arxiv.org/help/api/user-manual
Base URL: http://export.arxiv.org/api/query   (fixed — no user input)

No API key required.  arXiv asks polite clients to:
  * Send a descriptive User-Agent.
  * Wait 3 seconds between requests.
  * Use no more than one request per 3 seconds.

Application-level per-user rate limiting (10 req/min) is enforced upstream.
This provider does not duplicate that logic; it just respects the timeout.

XML parsing
-----------
Atom responses are parsed with ``defusedxml.ElementTree`` to prevent XXE
attacks.  The Atom namespace is ``{http://www.w3.org/2005/Atom}``.

Example entry structure (simplified):
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>…</title>
    <summary>…</summary>
    <author><name>…</name></author>
    <published>2023-01-01T00:00:00Z</published>
    <link rel="alternate" href="http://arxiv.org/abs/2301.00001" />
  </entry>
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

import httpx

try:
    import defusedxml.ElementTree as ET
except ImportError:
    import xml.etree.ElementTree as ET  # fallback for dev; defusedxml required in prod

from app.core.config import settings
from app.services.external.base import ExternalProvider, ExternalResult, truncate

# Fixed base URL — never accept user input for this.
_BASE = "http://export.arxiv.org/api/query"
_NS = "http://www.w3.org/2005/Atom"
_DOI_RE = re.compile(r"10\.\d{4,}/\S+")


def _tag(name: str) -> str:
    return f"{{{_NS}}}{name}"


def parse_arxiv_atom(xml_bytes: bytes) -> list[ExternalResult]:
    """Parse an arXiv Atom response and return a list of ExternalResult objects.

    This is a pure function with no side effects — safe to unit-test without
    making any HTTP calls.
    """
    root = ET.fromstring(xml_bytes)
    results: list[ExternalResult] = []

    for entry in root.iter(_tag("entry")):
        # arXiv ID — strip the version suffix, keep only abs ID
        raw_id = (entry.findtext(_tag("id")) or "").strip()
        # e.g. "http://arxiv.org/abs/2301.00001v1" → "2301.00001"
        id_match = re.search(r"arxiv\.org/abs/([^v\s]+)", raw_id, re.IGNORECASE)
        arxiv_id = id_match.group(1) if id_match else raw_id

        title_el = entry.find(_tag("title"))
        title = truncate((title_el.text or "").strip(), 300) if title_el is not None else "Untitled"

        summary_el = entry.find(_tag("summary"))
        abstract = truncate((summary_el.text or "").strip()) if summary_el is not None else ""

        authors: list[str] = []
        for author_el in entry.findall(_tag("author"))[:10]:
            name_el = author_el.find(_tag("name"))
            if name_el is not None and name_el.text:
                authors.append(truncate(name_el.text.strip(), 80))

        published_el = entry.find(_tag("published"))
        year: int | None = None
        if published_el is not None and published_el.text:
            try:
                year = int(published_el.text[:4])
            except ValueError:
                pass

        # Prefer the "alternate" link (abs page).
        url = f"https://arxiv.org/abs/{arxiv_id}"
        for link_el in entry.findall(_tag("link")):
            if link_el.get("rel") == "alternate":
                href = link_el.get("href", "")
                if href.startswith("http"):
                    url = href
                break

        # Try to extract a DOI from the comment or doi fields
        doi: str | None = None
        doi_el = entry.find("{http://arxiv.org/schemas/atom}doi")
        if doi_el is not None and doi_el.text:
            doi = doi_el.text.strip()
        if not doi:
            comment_el = entry.find("{http://arxiv.org/schemas/atom}comment")
            if comment_el is not None and comment_el.text:
                m = _DOI_RE.search(comment_el.text)
                if m:
                    doi = m.group(0).rstrip(".,;)")

        if arxiv_id:
            results.append(ExternalResult(
                source="arxiv",
                external_id=arxiv_id,
                doi=doi,
                title=title,
                abstract=abstract,
                authors=authors,
                year=year,
                url=url,
            ))

    return results


class ArXivProvider(ExternalProvider):
    """Fetches preprints from the arXiv public API."""

    def search(self, query: str, limit: int) -> list[ExternalResult]:  # noqa: D102
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": min(limit, 20),
        }
        headers = {
            "User-Agent": (
                f"ExperimentExchange/1.0 ({settings.external_contact_email})"
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
            raise HTTPException(504, "arXiv request timed out") from exc

        if resp.status_code == 429:
            retry = resp.headers.get("Retry-After", "60")
            from fastapi import HTTPException
            raise HTTPException(429, f"arXiv rate limit hit. Retry-After: {retry}s")
        if not resp.is_success:
            from fastapi import HTTPException
            raise HTTPException(502, f"arXiv returned {resp.status_code}")

        return parse_arxiv_atom(resp.content)

    def trending(self, limit: int = 5) -> list[ExternalResult]:
        """Newest AI preprints (cs.AI), used as a fallback when OpenAlex is unavailable."""
        from fastapi import HTTPException

        params = {
            "search_query": "cat:cs.AI",
            "sortBy": "submittedDate",
            "sortOrder": "descending",
            "start": 0,
            "max_results": min(limit, 20),
        }
        headers = {"User-Agent": f"ExperimentExchange/1.0 ({settings.external_contact_email})"}
        try:
            resp = httpx.get(_BASE, params=params, headers=headers,
                             timeout=settings.external_timeout_seconds, follow_redirects=True)
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "arXiv request timed out") from exc
        if not resp.is_success:
            raise HTTPException(502, f"arXiv returned {resp.status_code}")
        return parse_arxiv_atom(resp.content)

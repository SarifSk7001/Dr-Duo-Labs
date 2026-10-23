"""Base class and shared types for external literature providers.

Every provider must implement ``search(query, limit) -> list[ExternalResult]``.

Security notes
--------------
* Providers may only call fixed, hard-coded base URLs defined in each module.
  No user-supplied or dynamically constructed base URLs are ever fetched.
* All fetched text is HTML-stripped before it leaves this layer.
* Abstracts are hard-truncated to 2 000 characters.

Provider isolation
------------------
If one provider raises an exception the caller (external_search_service) must
catch it and continue with the other provider.  A single failing provider must
not surface as an application error.
"""

import re
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any


# ── shared sanitisation helpers ──────────────────────────────────────────────

_TAG_RE = re.compile(r"<[^>]+>")
_MULTI_WS_RE = re.compile(r"\s+")

ABSTRACT_MAX = 2_000


def strip_html(text: str) -> str:
    """Remove HTML tags and collapse whitespace."""
    clean = _TAG_RE.sub(" ", text or "")
    return _MULTI_WS_RE.sub(" ", clean).strip()


def truncate(text: str, max_len: int = ABSTRACT_MAX) -> str:
    text = strip_html(text)
    if len(text) <= max_len:
        return text
    return text[:max_len].rstrip() + "…"


# ── result dataclass (no ORM dependency here) ────────────────────────────────

class ExternalResult:
    """Plain Python object returned by every provider."""

    __slots__ = (
        "source", "external_id", "doi", "title", "abstract",
        "authors", "year", "url", "retrieved_at",
    )

    def __init__(
        self,
        *,
        source: str,
        external_id: str,
        doi: str | None,
        title: str,
        abstract: str,
        authors: list[str],
        year: int | None,
        url: str,
        retrieved_at: datetime | None = None,
    ) -> None:
        self.source = source
        self.external_id = external_id
        self.doi = doi
        self.title = title
        self.abstract = abstract
        self.authors = authors[:10]
        self.year = year
        self.url = url
        self.retrieved_at = retrieved_at or datetime.now(timezone.utc)


# ── provider interface ────────────────────────────────────────────────────────

class ExternalProvider(ABC):
    @abstractmethod
    def search(self, query: str, limit: int) -> list[ExternalResult]:
        """Return up to *limit* results for *query*.  Must not raise on transient errors."""

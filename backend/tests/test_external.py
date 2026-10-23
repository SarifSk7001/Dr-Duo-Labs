"""Tests for Phase A: external literature search (no real network calls).

All tests run offline — no HTTP calls to OpenAlex or arXiv are made.
httpx.MockTransport is used to inject fixture responses.
"""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.external.base import strip_html, truncate, ABSTRACT_MAX
from app.services.external.openalex import reconstruct_abstract, OpenAlexProvider
from app.services.external.arxiv import parse_arxiv_atom, ArXivProvider


# ── Helpers ────────────────────────────────────────────────────────────────────

class MockResponse:
    """Minimal httpx.Response stand-in for unit tests."""

    def __init__(self, status_code: int, body: bytes | dict | str, headers: dict | None = None):
        self.status_code = status_code
        self._body = body if isinstance(body, bytes) else (
            json.dumps(body).encode() if isinstance(body, dict) else body.encode()
        )
        self.headers = headers or {}
        self.is_success = 200 <= status_code < 300
        self.content = self._body

    def json(self):
        return json.loads(self._body)


# ── strip_html / truncate ─────────────────────────────────────────────────────

def test_strip_html_removes_tags():
    assert strip_html("<b>Hello</b> <em>World</em>") == "Hello World"


def test_strip_html_collapses_whitespace():
    assert strip_html("a   <br/>   b") == "a b"


def test_truncate_respects_limit():
    long_text = "a" * 3000
    result = truncate(long_text, ABSTRACT_MAX)
    assert len(result) <= ABSTRACT_MAX + 1  # +1 for ellipsis
    assert result.endswith("…")


def test_truncate_short_text_unchanged():
    short = "Hello world"
    assert truncate(short) == short


def test_truncate_strips_html_first():
    html = "<p>" + "x" * 100 + "</p>"
    result = truncate(html, 50)
    assert "<" not in result


# ── OpenAlex: reconstruct_abstract ────────────────────────────────────────────

def test_reconstruct_abstract_basic():
    # "Hello World" stored as {Hello: [0], World: [1]}
    index = {"Hello": [0], "World": [1]}
    assert reconstruct_abstract(index) == "Hello World"


def test_reconstruct_abstract_out_of_order():
    index = {"World": [1], "Hello": [0], "again": [2]}
    assert reconstruct_abstract(index) == "Hello World again"


def test_reconstruct_abstract_multi_occurrence():
    index = {"the": [0, 3], "cat": [1], "sat": [2]}
    assert reconstruct_abstract(index) == "the cat sat the"


def test_reconstruct_abstract_none_returns_empty():
    assert reconstruct_abstract(None) == ""


def test_reconstruct_abstract_empty_dict_returns_empty():
    assert reconstruct_abstract({}) == ""


# ── OpenAlex: provider with mock HTTP ────────────────────────────────────────

_OPENALEX_RESPONSE = {
    "results": [
        {
            "id": "https://openalex.org/W1234567890",
            "doi": "https://doi.org/10.1000/test.001",
            "title": "A Test Paper",
            "abstract_inverted_index": {"Cache": [0], "latency": [1], "matters": [2]},
            "authorships": [
                {"author": {"display_name": "Alice Smith"}},
                {"author": {"display_name": "Bob Jones"}},
            ],
            "publication_year": 2023,
            "primary_location": {"landing_page_url": "https://example.com/paper1"},
        }
    ]
}


def test_openalex_provider_parses_response():
    with patch("httpx.get", return_value=MockResponse(200, _OPENALEX_RESPONSE)):
        with patch("app.services.external.openalex.settings") as mock_settings:
            mock_settings.openalex_api_key = "test@example.com"
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = OpenAlexProvider()
            results = provider.search("cache latency", limit=5)

    assert len(results) == 1
    r = results[0]
    assert r.source == "openalex"
    assert r.external_id == "W1234567890"
    assert r.doi == "10.1000/test.001"
    assert r.title == "A Test Paper"
    assert r.abstract == "Cache latency matters"
    assert r.authors == ["Alice Smith", "Bob Jones"]
    assert r.year == 2023
    assert r.url == "https://example.com/paper1"


def test_openalex_missing_api_key_raises_400():
    from fastapi import HTTPException
    # Patch settings at the point of import inside the openalex module
    with patch("app.services.external.openalex.settings") as mock_settings:
        mock_settings.openalex_api_key = ""
        mock_settings.external_contact_email = "test@example.com"
        mock_settings.external_timeout_seconds = 10
        provider = OpenAlexProvider()
        with pytest.raises(HTTPException) as exc_info:
            provider.search("test query", limit=5)
    assert exc_info.value.status_code == 400
    assert "OPENALEX_API_KEY" in exc_info.value.detail


def test_openalex_429_raises_http_exception():
    from fastapi import HTTPException
    with patch("httpx.get", return_value=MockResponse(429, b"rate limited", headers={"Retry-After": "30"})):
        with patch("app.services.external.openalex.settings") as mock_settings:
            mock_settings.openalex_api_key = "test@example.com"
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = OpenAlexProvider()
            with pytest.raises(HTTPException) as exc_info:
                provider.search("query", limit=5)
    assert exc_info.value.status_code == 429


def test_openalex_timeout_raises_504():
    import httpx as _httpx
    from fastapi import HTTPException
    with patch("httpx.get", side_effect=_httpx.TimeoutException("timed out")):
        with patch("app.services.external.openalex.settings") as mock_settings:
            mock_settings.openalex_api_key = "test@example.com"
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = OpenAlexProvider()
            with pytest.raises(HTTPException) as exc_info:
                provider.search("query", limit=5)
    assert exc_info.value.status_code == 504


def test_openalex_502_on_server_error():
    from fastapi import HTTPException
    with patch("httpx.get", return_value=MockResponse(503, b"service unavailable")):
        with patch("app.services.external.openalex.settings") as mock_settings:
            mock_settings.openalex_api_key = "test@example.com"
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = OpenAlexProvider()
            with pytest.raises(HTTPException) as exc_info:
                provider.search("query", limit=5)
    assert exc_info.value.status_code == 502


# ── arXiv: Atom XML parsing ────────────────────────────────────────────────────

_ARXIV_ATOM = b"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2301.00001v1</id>
    <title>Cache Latency in Distributed Systems</title>
    <summary>This paper studies cache latency and its impact on performance.</summary>
    <author><name>Alice Smith</name></author>
    <author><name>Bob Jones</name></author>
    <published>2023-01-15T00:00:00Z</published>
    <link rel="alternate" href="http://arxiv.org/abs/2301.00001"/>
  </entry>
</feed>"""


def test_arxiv_parse_basic():
    results = parse_arxiv_atom(_ARXIV_ATOM)
    assert len(results) == 1
    r = results[0]
    assert r.source == "arxiv"
    assert r.external_id == "2301.00001"
    assert r.title == "Cache Latency in Distributed Systems"
    assert "cache latency" in r.abstract.lower()
    assert r.authors == ["Alice Smith", "Bob Jones"]
    assert r.year == 2023
    assert "2301.00001" in r.url


def test_arxiv_parse_empty_feed():
    atom = b"""<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom"></feed>"""
    assert parse_arxiv_atom(atom) == []


def test_arxiv_provider_429_raises():
    import httpx as _httpx
    from fastapi import HTTPException
    with patch("httpx.get", return_value=MockResponse(429, b"rate limited", headers={"Retry-After": "60"})):
        with patch("app.services.external.arxiv.settings") as mock_settings:
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = ArXivProvider()
            with pytest.raises(HTTPException) as exc_info:
                provider.search("query", limit=5)
    assert exc_info.value.status_code == 429


def test_arxiv_provider_timeout_raises_504():
    import httpx as _httpx
    from fastapi import HTTPException
    with patch("httpx.get", side_effect=_httpx.TimeoutException("timed out")):
        with patch("app.services.external.arxiv.settings") as mock_settings:
            mock_settings.external_contact_email = "test@example.com"
            mock_settings.external_timeout_seconds = 10
            provider = ArXivProvider()
            with pytest.raises(HTTPException) as exc_info:
                provider.search("query", limit=5)
    assert exc_info.value.status_code == 504


# ── Cache hit/miss ─────────────────────────────────────────────────────────────

def test_cache_hit_reuses_existing_results():
    """When a fresh ExternalQuery row exists, the service returns cached rows."""
    from app.services.external_search_service import search_external
    from app.models import ExternalQuery, ExternalSource

    mock_source = MagicMock(spec=ExternalSource)
    mock_source.id = 1
    mock_source.source = "arxiv"
    mock_source.external_id = "2301.00001"
    mock_source.doi = None
    mock_source.title = "Cache Latency in Distributed Systems"
    mock_source.abstract = "This paper studies cache latency."
    mock_source.authors = ["Alice Smith"]
    mock_source.year = 2023
    mock_source.url = "https://arxiv.org/abs/2301.00001"
    mock_source.retrieved_at = datetime.now(timezone.utc)
    mock_source.code = "EXT-001"

    mock_query = MagicMock(spec=ExternalQuery)
    mock_query.result_ids = [1]

    mock_db = MagicMock()
    mock_db.scalar.return_value = mock_query           # fresh cache hit
    mock_db.scalars.return_value.all.return_value = [mock_source]

    with patch("app.services.external_search_service.settings") as mock_settings:
        mock_settings.external_search_enabled = True
        mock_settings.external_cache_hours = 24
        results, from_cache = search_external(mock_db, "cache latency", source="arxiv", limit=5)

    assert from_cache is True
    assert len(results) == 1
    assert results[0]["cached"] is True
    assert results[0]["title"] == "Cache Latency in Distributed Systems"


def test_disabled_feature_raises_404():
    from fastapi import HTTPException
    from app.services.external_search_service import search_external

    mock_db = MagicMock()
    with patch("app.services.external_search_service.settings") as mock_settings:
        mock_settings.external_search_enabled = False
        with pytest.raises(HTTPException) as exc_info:
            search_external(mock_db, "test", source="all", limit=5)
    assert exc_info.value.status_code == 404


# ── HTML stripping in prompt context ──────────────────────────────────────────

def test_strip_html_prevents_injection():
    malicious = '<script>alert("xss")</script>Important finding: X causes Y.'
    clean = strip_html(malicious)
    assert "<script>" not in clean
    assert "Important finding" in clean


def test_abstract_truncation_is_bounded():
    very_long = "word " * 1000
    result = truncate(very_long)
    # Must be at most ABSTRACT_MAX + 1 (ellipsis character) characters
    assert len(result) <= ABSTRACT_MAX + 1


# ── Import endpoint (unit-level) ─────────────────────────────────────────────

def test_import_nonexistent_source_raises_404():
    """Importing a source_id that doesn't exist must return 404."""
    from fastapi import HTTPException
    from app.api.routes.external import import_external_source

    mock_db = MagicMock()
    mock_db.get.return_value = None  # no ExternalSource found

    mock_user = MagicMock()
    mock_user.id = 1

    with patch("app.api.routes.external.settings") as mock_settings:
        mock_settings.external_search_enabled = True
        with pytest.raises(HTTPException) as exc_info:
            import_external_source(source_id=999, db=mock_db, user=mock_user)
    assert exc_info.value.status_code == 404


def test_import_disabled_raises_404():
    """When EXTERNAL_SEARCH_ENABLED=false, import also returns 404."""
    from fastapi import HTTPException
    from app.api.routes.external import import_external_source

    mock_db = MagicMock()
    mock_user = MagicMock()
    mock_user.id = 1

    with patch("app.api.routes.external.settings") as mock_settings:
        mock_settings.external_search_enabled = False
        with pytest.raises(HTTPException) as exc_info:
            import_external_source(source_id=1, db=mock_db, user=mock_user)
    assert exc_info.value.status_code == 404


def test_import_creates_private_draft():
    """Importing a valid source creates a private Draft experiment."""
    from app.api.routes.external import import_external_source
    from app.models import ExternalSource, Experiment

    mock_src = MagicMock(spec=ExternalSource)
    mock_src.id = 1
    mock_src.source = "arxiv"
    mock_src.external_id = "2301.00001"
    mock_src.doi = None
    mock_src.title = "Cache Latency in Distributed Systems"
    mock_src.abstract = "This paper studies cache latency." * 5
    mock_src.url = "https://arxiv.org/abs/2301.00001"
    mock_src.retrieved_at = datetime.now(timezone.utc)

    captured_exp = {}

    def fake_add(obj):
        if isinstance(obj, Experiment):
            obj.id = 42  # simulate DB-assigned PK
            captured_exp["exp"] = obj

    mock_db = MagicMock()
    mock_db.get.return_value = mock_src
    mock_db.add.side_effect = fake_add
    mock_db.flush.return_value = None
    mock_db.commit.return_value = None

    mock_user = MagicMock()
    mock_user.id = 7

    with patch("app.api.routes.external.settings") as mock_settings:
        mock_settings.external_search_enabled = True
        with patch("app.api.routes.external.embed_text", return_value=[0.0] * 10):
            with patch("app.api.routes.external.experiment_text", return_value="text"):
                with patch("app.api.routes.external.write_audit"):
                    with patch("app.api.routes.external._enrich") as mock_enrich:
                        mock_enrich.side_effect = lambda e: e
                        mock_db.refresh.return_value = None
                        import_external_source(source_id=1, db=mock_db, user=mock_user)

    assert "exp" in captured_exp
    exp = captured_exp["exp"]
    assert exp.visibility == "private"
    assert exp.review_status == "Draft"
    assert exp.owner_id == 7
    assert exp.domain == "literature import"
    assert exp.research_question == ""
    assert exp.hypothesis_text == ""
    assert "Imported abstract:" in exp.results_summary
    assert exp.provenance["source"] == "arxiv"
    assert exp.provenance["ai_extracted"] is False
    assert exp.provenance["imported_by"] == 7

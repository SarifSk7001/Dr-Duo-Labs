import pytest

from app.schemas import EvidenceRef
from app.services.embedding_service import _fallback_embedding
from app.services.hypothesis_service import parse_code, validate_refs
from app.services.llm_service import extract_json


def test_parse_code():
    assert parse_code("EXP-007") == 7
    assert parse_code("exp-12") == 12
    assert parse_code("nonsense") is None


def test_validate_refs_drops_invented_and_inaccessible_ids():
    refs = [EvidenceRef(experiment_id="EXP-001"), EvidenceRef(experiment_id="EXP-999"), EvidenceRef(experiment_id="bad")]
    kept, dropped = validate_refs(refs, {1, 2})
    assert [r.experiment_id for r in kept] == ["EXP-001"]
    assert dropped == 2


def test_extract_json_handles_surrounding_text():
    assert extract_json('Sure! {"a": 1} Hope that helps') == {"a": 1}
    with pytest.raises(ValueError):
        extract_json("no json here")


def test_fallback_embedding_is_deterministic_and_normalised():
    a, b = _fallback_embedding("cache latency"), _fallback_embedding("cache latency")
    assert a == b
    assert abs(sum(x * x for x in a) - 1.0) < 1e-6

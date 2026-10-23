from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Outcome = Literal["supported", "contradicted", "inconclusive", "partially supported", "not completed"]
Visibility = Literal["private", "public"]


# ---------- auth ----------
class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- experiments ----------
class MeasurementCreate(BaseModel):
    variable_name: str
    value: float | str
    unit: str = ""
    trial_number: int = 1
    conditions: dict = {}


class MeasurementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    variable_name: str
    value_num: float | None
    value_text: str | None
    unit: str
    trial_number: int
    conditions: dict
    recorded_at: datetime


class ExperimentBase(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    domain: str = Field(min_length=1, max_length=120)
    research_question: str = ""
    hypothesis_text: str = ""
    methodology: str = ""
    variables: dict = {}
    conditions: dict = {}
    sample_size: int | None = None
    outcome: Outcome = "not completed"
    results_summary: str = ""
    limitations: str = ""
    visibility: Visibility = "private"


class ExperimentCreate(ExperimentBase):
    parent_id: int | None = None
    hypothesis_id: int | None = None


class ExperimentUpdate(BaseModel):
    title: str | None = None
    domain: str | None = None
    research_question: str | None = None
    hypothesis_text: str | None = None
    methodology: str | None = None
    variables: dict | None = None
    conditions: dict | None = None
    sample_size: int | None = None
    outcome: Outcome | None = None
    results_summary: str | None = None
    limitations: str | None = None
    visibility: Visibility | None = None


# Documentation completeness fields — a field counts as "documented" if non-empty / non-null.
DOC_FIELDS: list[tuple[str, str]] = [
    ("research_question", "Research question"),
    ("hypothesis_text",   "Hypothesis"),
    ("methodology",       "Methodology"),
    ("sample_size",       "Sample size"),
    ("conditions",        "Conditions"),
    ("results_summary",   "Results summary"),
    ("limitations",       "Limitations"),
    ("outcome",           "Outcome"),
]
DOC_TOTAL = len(DOC_FIELDS)


def doc_score(exp: "ExperimentOut | dict") -> tuple[int, int]:
    """Return (documented_count, total) for an experiment."""
    documented = 0
    for field, _ in DOC_FIELDS:
        val = exp[field] if isinstance(exp, dict) else getattr(exp, field, None)
        if val is not None and val != "" and val != {} and val != [] and val != "not completed":
            documented += 1
    return documented, DOC_TOTAL


class ExperimentOut(ExperimentBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    owner_id: int
    review_status: str
    version: int
    is_sample: bool
    hypothesis_id: int | None
    parent_ids: list[int]
    follow_up_ids: list[int]
    measurements: list[MeasurementOut]
    created_at: datetime
    updated_at: datetime
    doc_score: int = 0        # documented fields count
    doc_total: int = DOC_TOTAL  # total possible fields
    provenance: dict | None = None  # set when imported from external literature


class SearchHit(BaseModel):
    experiment: ExperimentOut
    score: float
    reason: str


class ReviewIn(BaseModel):
    approved: bool


# ---------- hypotheses ----------
class HypothesisCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    statement: str = Field(min_length=10)
    research_question: str = ""
    expected_effect: str = ""
    variables: dict = {}
    constraints: dict = {}


class HypothesisOut(HypothesisCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    created_at: datetime


class EvidenceRef(BaseModel):
    experiment_id: str
    reason: str = ""


class ProposedTest(BaseModel):
    objective: str
    controls: list[str] = []
    measurements: list[str] = []
    interpretation: str = ""


class CritiqueOut(BaseModel):
    model_config = ConfigDict(frozen=False)

    hypothesis_summary: str = ""
    assumptions: list[str] = []
    potential_confounders: list[str] = []
    alternative_explanations: list[str] = []
    supporting_evidence: list[EvidenceRef] = []
    contradicting_evidence: list[EvidenceRef] = []
    evidence_gaps: list[str] = []
    proposed_tests: list[ProposedTest] = []
    uncertainty_notes: list[str] = []


class DesignOut(BaseModel):
    model_config = ConfigDict(frozen=False)

    title: str
    objective: str
    competing_explanations: list[str] = []
    independent_variables: list[str] = []
    controls: list[str] = []
    measurements: list[str] = []
    procedure: list[str] = []
    sample_size_notes: str = ""
    evaluation_metrics: list[str] = []
    outcome_interpretations: list[str] = []
    limitations: list[str] = []
    safety_notes: list[str] = []
    requires_human_review: bool = True


class EvidenceBrief(BaseModel):
    id: int
    code: str
    title: str
    outcome: str


class AnalysisOut(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: int
    hypothesis_id: int
    analysis_version: int
    critique: CritiqueOut
    evidence: list[EvidenceBrief]
    dropped_refs: int
    model_info: str
    created_at: datetime


# ---------- evidence files ----------
class EvidenceFileMeta(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    experiment_id: int
    filename: str
    mime_type: str
    size_bytes: int
    uploaded_by: int | None
    created_at: datetime


# ---------- audit / version history ----------
class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int | None
    action: str
    resource_type: str
    resource_id: int | None
    timestamp: datetime
    extra: dict[str, Any]


class ExperimentVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    experiment_id: int
    version: int
    snapshot: dict[str, Any]
    changed_by: int | None
    created_at: datetime


# ---------- external literature ----------
class ExternalSourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    source: str
    external_id: str
    doi: str | None
    title: str
    abstract: str
    authors: list[str]
    year: int | None
    url: str
    retrieved_at: datetime
    cached: bool = False          # populated at service layer, not in DB

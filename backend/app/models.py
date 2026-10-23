from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import settings
from app.db.session import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="Researcher")  # Researcher | Reviewer | Administrator
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Hypothesis(Base):
    __tablename__ = "hypotheses"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    statement: Mapped[str] = mapped_column(Text)
    research_question: Mapped[str] = mapped_column(Text, default="")
    expected_effect: Mapped[str] = mapped_column(Text, default="")
    variables: Mapped[dict] = mapped_column(JSONB, default=dict)
    constraints: Mapped[dict] = mapped_column(JSONB, default=dict)
    status: Mapped[str] = mapped_column(String(20), default="Open")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Experiment(Base):
    __tablename__ = "experiments"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    domain: Mapped[str] = mapped_column(String(120), index=True)
    research_question: Mapped[str] = mapped_column(Text, default="")
    hypothesis_text: Mapped[str] = mapped_column(Text, default="")
    methodology: Mapped[str] = mapped_column(Text, default="")
    variables: Mapped[dict] = mapped_column(JSONB, default=dict)
    conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    outcome: Mapped[str] = mapped_column(String(30), default="not completed", index=True)
    results_summary: Mapped[str] = mapped_column(Text, default="")
    limitations: Mapped[str] = mapped_column(Text, default="")
    visibility: Mapped[str] = mapped_column(String(10), default="private")  # private | public
    review_status: Mapped[str] = mapped_column(String(20), default="Draft")
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    hypothesis_id: Mapped[int | None] = mapped_column(ForeignKey("hypotheses.id"), nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    embedding = mapped_column(Vector(settings.embedding_dim), nullable=True)
    provenance: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # set on literature import
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    measurements = relationship("Measurement", cascade="all, delete-orphan", order_by="Measurement.id", lazy="selectin")
    parent_links = relationship(
        "ExperimentRelationship", foreign_keys="ExperimentRelationship.source_experiment_id", lazy="selectin"
    )
    child_links = relationship(
        "ExperimentRelationship", foreign_keys="ExperimentRelationship.target_experiment_id", lazy="selectin"
    )

    @property
    def code(self) -> str:
        return f"EXP-{self.id:03d}"

    @property
    def parent_ids(self) -> list[int]:
        return [l.target_experiment_id for l in self.parent_links]

    @property
    def follow_up_ids(self) -> list[int]:
        return [l.source_experiment_id for l in self.child_links]


class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    variable_name: Mapped[str] = mapped_column(String(200))
    value_num = mapped_column(Float, nullable=True)
    value_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    unit: Mapped[str] = mapped_column(String(40), default="")
    trial_number: Mapped[int] = mapped_column(Integer, default=1)
    conditions: Mapped[dict] = mapped_column(JSONB, default=dict)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExperimentRelationship(Base):
    """source_experiment is a follow-up of target_experiment."""

    __tablename__ = "experiment_relationships"
    id: Mapped[int] = mapped_column(primary_key=True)
    source_experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    target_experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    relationship_type: Mapped[str] = mapped_column(String(40), default="follow_up_of")


class HypothesisAnalysis(Base):
    __tablename__ = "hypothesis_analyses"
    id: Mapped[int] = mapped_column(primary_key=True)
    hypothesis_id: Mapped[int] = mapped_column(ForeignKey("hypotheses.id", ondelete="CASCADE"), index=True)
    analysis_version: Mapped[int] = mapped_column(Integer, default=1)
    critique: Mapped[dict] = mapped_column(JSONB)
    evidence_ids: Mapped[list] = mapped_column(JSONB, default=list)
    dropped_refs: Mapped[int] = mapped_column(Integer, default=0)
    model_info: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Immutable audit trail — never modified after insert.

    Sensitive fields (passwords, tokens, API keys) must never appear in the
    ``extra`` column.  The write helper enforces this by design.
    """

    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(60))        # e.g. "create", "update", "archive"
    resource_type: Mapped[str] = mapped_column(String(60), index=True)  # e.g. "experiment"
    resource_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    extra: Mapped[dict] = mapped_column("metadata", JSONB, default=dict)


class ExperimentVersion(Base):
    """Snapshot of an experiment's state before each update."""

    __tablename__ = "experiment_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    version: Mapped[int] = mapped_column(Integer)          # version number at time of snapshot
    snapshot: Mapped[dict] = mapped_column(JSONB)          # full experiment fields before change
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ExternalSource(Base):
    """Cached metadata from an external literature provider (OpenAlex, arXiv).

    The ``data`` column is intentionally absent: we store ONLY metadata and the
    abstract.  Full text and PDFs are never downloaded or stored.

    All text in this table is UNTRUSTED (fetched from external APIs) and must
    be rendered as plain text, never as HTML.
    """

    __tablename__ = "external_sources"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_external_source"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    source: Mapped[str] = mapped_column(String(20), index=True)           # "openalex" | "arxiv"
    external_id: Mapped[str] = mapped_column(String(200))                 # provider's own ID
    doi: Mapped[str | None] = mapped_column(String(200), nullable=True)
    title: Mapped[str] = mapped_column(Text)
    abstract: Mapped[str] = mapped_column(Text, default="")
    authors: Mapped[list] = mapped_column(JSONB, default=list)            # list[str], max 10
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str] = mapped_column(String(500))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def code(self) -> str:
        return f"EXT-{self.id:03d}"


class ExternalQuery(Base):
    """Cache table for external search queries.

    A row records which ExternalSource IDs were returned for a normalised query
    string from a given source.  Rows younger than EXTERNAL_CACHE_HOURS are
    returned directly without hitting external APIs.
    """

    __tablename__ = "external_queries"

    id: Mapped[int] = mapped_column(primary_key=True)
    query_norm: Mapped[str] = mapped_column(Text, index=True)             # lowercased, collapsed
    source: Mapped[str] = mapped_column(String(20))                       # "openalex" | "arxiv" | "all"
    result_ids: Mapped[list] = mapped_column(JSONB, default=list)         # list[int] → ExternalSource.id
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)


class EvidenceFile(Base):
    """Binary evidence attached to an experiment (CSV, PDF, image).

    Files are stored as bytea in PostgreSQL, which is appropriate for the
    typical evidence-file sizes (<= 10 MB).  For larger deployments swap the
    ``data`` column for an S3/object-store URL.
    """

    __tablename__ = "evidence_files"

    ALLOWED_MIME = {
        "text/csv", "application/pdf",
        "image/png", "image/jpeg", "image/gif", "image/webp",
    }
    MAX_BYTES = 10 * 1024 * 1024  # 10 MB

    id: Mapped[int] = mapped_column(primary_key=True)
    experiment_id: Mapped[int] = mapped_column(ForeignKey("experiments.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(260))
    mime_type: Mapped[str] = mapped_column(String(80))
    size_bytes: Mapped[int] = mapped_column(Integer)
    data: Mapped[bytes] = mapped_column(LargeBinary)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

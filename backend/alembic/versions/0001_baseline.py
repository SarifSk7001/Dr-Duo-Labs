"""Baseline — full initial schema including audit_logs and experiment_versions.

Revision ID: 0001_baseline
Revises:
Create Date: 2025-01-01 00:00:00.000000

This migration represents the state of the database as shipped.
If the database already exists (tables are already present), run:

    alembic stamp 0001_baseline

from the ``backend/`` directory to mark it as current without re-running DDL.

For a brand-new database, run:

    alembic upgrade head

That will create the vector extension and all tables in one step.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # Core tables
    # ------------------------------------------------------------------
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="Researcher"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "hypotheses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("research_question", sa.Text(), nullable=False, server_default=""),
        sa.Column("expected_effect", sa.Text(), nullable=False, server_default=""),
        sa.Column("variables", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("constraints", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="Open"),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_hypotheses_owner_id"), "hypotheses", ["owner_id"])

    op.create_table(
        "experiments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("domain", sa.String(length=120), nullable=False),
        sa.Column("research_question", sa.Text(), nullable=False, server_default=""),
        sa.Column("hypothesis_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("methodology", sa.Text(), nullable=False, server_default=""),
        sa.Column("variables", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("sample_size", sa.Integer(), nullable=True),
        sa.Column("outcome", sa.String(length=30), nullable=False, server_default="not completed"),
        sa.Column("results_summary", sa.Text(), nullable=False, server_default=""),
        sa.Column("limitations", sa.Text(), nullable=False, server_default=""),
        sa.Column("visibility", sa.String(length=10), nullable=False, server_default="private"),
        sa.Column("review_status", sa.String(length=20), nullable=False, server_default="Draft"),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("hypothesis_id", sa.Integer(), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_sample", sa.Boolean(), nullable=False, server_default="false"),
        # Vector column — pgvector must already exist (created in env.py)
        sa.Column("embedding", sa.Text(), nullable=True),  # stored as opaque by SA reflection
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hypothesis_id"], ["hypotheses.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_experiments_domain"), "experiments", ["domain"])
    op.create_index(op.f("ix_experiments_outcome"), "experiments", ["outcome"])
    op.create_index(op.f("ix_experiments_owner_id"), "experiments", ["owner_id"])

    # Replace the placeholder text column with a real vector column
    op.execute("ALTER TABLE experiments DROP COLUMN embedding")
    op.execute("ALTER TABLE experiments ADD COLUMN embedding vector(768)")

    op.create_table(
        "measurements",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("experiment_id", sa.Integer(), nullable=False),
        sa.Column("variable_name", sa.String(length=200), nullable=False),
        sa.Column("value_num", sa.Float(), nullable=True),
        sa.Column("value_text", sa.String(length=500), nullable=True),
        sa.Column("unit", sa.String(length=40), nullable=False, server_default=""),
        sa.Column("trial_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("conditions", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "recorded_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["experiment_id"], ["experiments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_measurements_experiment_id"), "measurements", ["experiment_id"])

    op.create_table(
        "experiment_relationships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_experiment_id", sa.Integer(), nullable=False),
        sa.Column("target_experiment_id", sa.Integer(), nullable=False),
        sa.Column("relationship_type", sa.String(length=40), nullable=False, server_default="follow_up_of"),
        sa.ForeignKeyConstraint(
            ["source_experiment_id"], ["experiments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["target_experiment_id"], ["experiments.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_experiment_relationships_source_experiment_id"),
        "experiment_relationships",
        ["source_experiment_id"],
    )
    op.create_index(
        op.f("ix_experiment_relationships_target_experiment_id"),
        "experiment_relationships",
        ["target_experiment_id"],
    )

    op.create_table(
        "hypothesis_analyses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("hypothesis_id", sa.Integer(), nullable=False),
        sa.Column("analysis_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("critique", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("evidence_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("dropped_refs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("model_info", sa.String(length=120), nullable=False, server_default=""),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["hypothesis_id"], ["hypotheses.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_hypothesis_analyses_hypothesis_id"),
        "hypothesis_analyses",
        ["hypothesis_id"],
    )

    # ------------------------------------------------------------------
    # Audit log
    # ------------------------------------------------------------------
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=60), nullable=False),
        sa.Column("resource_type", sa.String(length=60), nullable=False),
        sa.Column("resource_id", sa.Integer(), nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "metadata",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"])
    op.create_index(op.f("ix_audit_logs_resource_type"), "audit_logs", ["resource_type"])
    op.create_index(op.f("ix_audit_logs_timestamp"), "audit_logs", ["timestamp"])

    # ------------------------------------------------------------------
    # Experiment version history
    # ------------------------------------------------------------------
    op.create_table(
        "experiment_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("experiment_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("changed_by", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["experiment_id"], ["experiments.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_experiment_versions_experiment_id"),
        "experiment_versions",
        ["experiment_id"],
    )


def downgrade() -> None:
    op.drop_table("experiment_versions")
    op.drop_table("audit_logs")
    op.drop_table("hypothesis_analyses")
    op.drop_table("experiment_relationships")
    op.drop_table("measurements")
    op.drop_table("experiments")
    op.drop_table("hypotheses")
    op.drop_table("users")

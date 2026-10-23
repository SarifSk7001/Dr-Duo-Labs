"""Add external_sources and external_queries tables.

Revision ID: 0003_external_sources
Revises: 0002_evidence_files
Create Date: 2025-01-03 00:00:00.000000

These two tables cache metadata fetched from external literature providers
(OpenAlex, arXiv).  Full text and PDFs are never stored.

For an existing database run:
    alembic upgrade head

For an existing database that already had Alembic run through 0002:
    alembic upgrade 0003_external_sources
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003_external_sources"
down_revision: Union[str, None] = "0002_evidence_files"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "external_sources",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("external_id", sa.String(length=200), nullable=False),
        sa.Column("doi", sa.String(length=200), nullable=True),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("abstract", sa.Text(), nullable=False, server_default=""),
        sa.Column("authors", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("year", sa.Integer(), nullable=True),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column(
            "retrieved_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_id", name="uq_external_source"),
    )
    op.create_index(op.f("ix_external_sources_source"), "external_sources", ["source"])

    op.create_table(
        "external_queries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("query_norm", sa.Text(), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
        sa.Column("result_ids", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_external_queries_query_norm"), "external_queries", ["query_norm"])
    op.create_index(op.f("ix_external_queries_fetched_at"), "external_queries", ["fetched_at"])


def downgrade() -> None:
    op.drop_table("external_queries")
    op.drop_table("external_sources")

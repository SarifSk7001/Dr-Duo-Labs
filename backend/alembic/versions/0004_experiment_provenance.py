"""Add provenance column to experiments.

Revision ID: 0004_experiment_provenance
Revises: 0003_external_sources
Create Date: 2025-01-04 00:00:00.000000

Adds a nullable JSONB ``provenance`` column to the ``experiments`` table.
This is populated when a record is imported from an external literature source
(OpenAlex / arXiv).  It holds:
  {source, external_id, doi, url, retrieved_at, imported_by, imported_at, ai_extracted: false}

Existing rows get NULL (correct — they were not imported from literature).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004_experiment_provenance"
down_revision: Union[str, None] = "0003_external_sources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "experiments",
        sa.Column(
            "provenance",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("experiments", "provenance")

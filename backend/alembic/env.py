"""Alembic environment configuration.

Reads the database URL from the application settings so there is a single
source of truth.  The ``vector`` extension is created before any migration
runs so pgvector column types are always available.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, text

from app.core.config import settings
from app.db.session import Base  # noqa: F401 — triggers model registration
import app.models  # noqa: F401 — registers all ORM classes

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _get_url() -> str:
    # The ini may override; fall back to app settings.
    url = config.get_main_option("sqlalchemy.url")
    return url or settings.database_url


def run_migrations_offline() -> None:
    url = _get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_get_url(), pool_pre_ping=True)

    # Ensure the vector extension exists before any migration touches
    # Vector columns; this is idempotent.
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))

    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()

    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

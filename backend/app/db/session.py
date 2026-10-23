from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Run Alembic migrations at startup.

    This replaces the old ``Base.metadata.create_all`` call so that all schema
    changes go through versioned migrations.

    Existing database:
        If the database was created before Alembic was added, mark it as current
        without re-running DDL::

            cd backend
            alembic stamp 0001_baseline

    New database:
        Alembic will run ``upgrade head`` automatically here, which creates the
        pgvector extension and all tables.

    Note: in-process migration is safe for a single-worker deployment.  For
    multi-worker deployments run ``alembic upgrade head`` as a pre-start step
    (e.g. an init container) and remove this call.
    """
    from alembic import command
    from alembic.config import Config

    import os

    # Locate alembic.ini relative to this file (backend/alembic.ini).
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    cfg = Config(os.path.join(base_dir, "alembic.ini"))
    # Inject the runtime URL so the ini file doesn't need to duplicate it.
    cfg.set_main_option("sqlalchemy.url", settings.database_url)
    command.upgrade(cfg, "head")

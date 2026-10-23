"""Audit log and experiment version history helpers.

Rules
-----
* Never log passwords, tokens, or API keys in metadata.
* Every write is a plain INSERT — audit rows are never modified.
* ``snapshot_experiment`` must be called **before** the update is applied so
  that the snapshot reflects the *previous* state.
"""

from typing import Any

from sqlalchemy.orm import Session

from app.models import AuditLog, Experiment, ExperimentVersion

# Fields that must never appear in audit metadata or snapshots.
_FORBIDDEN_FIELDS = frozenset({"password", "password_hash", "token", "access_token", "api_key", "secret"})


def _scrub(d: dict) -> dict:
    """Remove any keys that match the forbidden-field list (case-insensitive)."""
    return {k: v for k, v in d.items() if k.lower() not in _FORBIDDEN_FIELDS}


# ── Audit log ─────────────────────────────────────────────────────────────────

def write_audit(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    resource_type: str,
    resource_id: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> AuditLog:
    """Insert one audit row and flush it to the session (does not commit)."""
    row = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        extra=_scrub(metadata or {}),
    )
    db.add(row)
    db.flush()
    return row


# ── Experiment version snapshots ──────────────────────────────────────────────

_SNAPSHOT_FIELDS = (
    "title", "domain", "research_question", "hypothesis_text", "methodology",
    "variables", "conditions", "sample_size", "outcome", "results_summary",
    "limitations", "visibility", "review_status", "version",
)


def snapshot_experiment(db: Session, exp: Experiment, changed_by_id: int | None) -> ExperimentVersion:
    """Save the current state of *exp* as a version snapshot.

    Call this **before** modifying the experiment so the snapshot captures the
    previous state.  Flushes but does not commit.
    """
    snap: dict[str, Any] = {f: getattr(exp, f) for f in _SNAPSHOT_FIELDS}
    row = ExperimentVersion(
        experiment_id=exp.id,
        version=exp.version,
        snapshot=snap,
        changed_by=changed_by_id,
    )
    db.add(row)
    db.flush()
    return row

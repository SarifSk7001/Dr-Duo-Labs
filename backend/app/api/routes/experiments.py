from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Experiment, ExperimentRelationship, ExperimentVersion, Hypothesis, Measurement, User
from app.schemas import (
    AuditLogOut, DOC_TOTAL, ExperimentCreate, ExperimentOut, ExperimentUpdate,
    ExperimentVersionOut, MeasurementCreate, MeasurementOut, ReviewIn, doc_score,
)
from app.services.access import get_owned_experiment, get_visible_experiment, visible_filter
from app.services.audit_service import snapshot_experiment, write_audit
from app.services.embedding_service import embed_text, experiment_text


def _enrich(exp: Experiment) -> ExperimentOut:
    """Convert an ORM Experiment to ExperimentOut, populating doc_score."""
    out = ExperimentOut.model_validate(exp)
    scored, total = doc_score(exp)
    out.doc_score = scored
    out.doc_total = total
    return out

router = APIRouter(prefix="/experiments", tags=["experiments"])


@router.post("", response_model=ExperimentOut, status_code=201)
def create_experiment(payload: ExperimentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    parent = get_visible_experiment(db, user, payload.parent_id) if payload.parent_id else None
    if payload.hypothesis_id:
        h = db.get(Hypothesis, payload.hypothesis_id)
        if not h or h.owner_id != user.id:
            raise HTTPException(404, "Hypothesis not found")
    exp = Experiment(**payload.model_dump(exclude={"parent_id"}), owner_id=user.id)
    exp.embedding = embed_text(experiment_text(exp))
    db.add(exp)
    db.flush()
    if parent:
        db.add(ExperimentRelationship(source_experiment_id=exp.id, target_experiment_id=parent.id))
    write_audit(db, user_id=user.id, action="create", resource_type="experiment",
                resource_id=exp.id, metadata={"title": exp.title})
    db.commit()
    db.refresh(exp)
    return _enrich(exp)


@router.get("", response_model=list[ExperimentOut])
def list_experiments(
    domain: str | None = None,
    outcome: str | None = None,
    mine: bool = False,
    limit: int = Query(20, le=100),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    stmt = select(Experiment).where(visible_filter(user), Experiment.review_status != "Archived")
    if mine:
        stmt = stmt.where(Experiment.owner_id == user.id)
    if domain:
        stmt = stmt.where(Experiment.domain.ilike(f"%{domain}%"))
    if outcome:
        stmt = stmt.where(Experiment.outcome == outcome)
    return [_enrich(e) for e in db.scalars(stmt.order_by(Experiment.created_at.desc()).limit(limit).offset(offset)).all()]


@router.get("/{experiment_id}", response_model=ExperimentOut)
def get_experiment(experiment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _enrich(get_visible_experiment(db, user, experiment_id))


@router.patch("/{experiment_id}", response_model=ExperimentOut)
def update_experiment(
    experiment_id: int, payload: ExperimentUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    exp = get_owned_experiment(db, user, experiment_id)
    # Snapshot the *previous* state before applying changes.
    snapshot_experiment(db, exp, changed_by_id=user.id)
    changed_fields = list(payload.model_dump(exclude_unset=True).keys())
    for key, value in payload.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(exp, key, value)
    exp.version += 1
    exp.embedding = embed_text(experiment_text(exp))  # re-index so new results are searchable
    write_audit(db, user_id=user.id, action="update", resource_type="experiment",
                resource_id=exp.id, metadata={"changed_fields": changed_fields, "new_version": exp.version})
    db.commit()
    db.refresh(exp)
    return _enrich(exp)


@router.delete("/{experiment_id}", status_code=204)
def archive_experiment(experiment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exp = get_owned_experiment(db, user, experiment_id)
    exp.review_status = "Archived"  # archive instead of hard delete to keep provenance
    write_audit(db, user_id=user.id, action="archive", resource_type="experiment",
                resource_id=exp.id, metadata={"title": exp.title})
    db.commit()


@router.post("/{experiment_id}/measurements", response_model=list[MeasurementOut], status_code=201)
def add_measurements(
    experiment_id: int,
    payload: list[MeasurementCreate],
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    exp = get_owned_experiment(db, user, experiment_id)
    rows = []
    for m in payload:
        is_num = isinstance(m.value, (int, float))
        rows.append(Measurement(
            experiment_id=exp.id, variable_name=m.variable_name,
            value_num=float(m.value) if is_num else None, value_text=None if is_num else str(m.value),
            unit=m.unit, trial_number=m.trial_number, conditions=m.conditions,
        ))
    db.add_all(rows)
    db.commit()
    for r in rows:
        db.refresh(r)
    return rows


@router.get("/{experiment_id}/measurements", response_model=list[MeasurementOut])
def list_measurements(experiment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_visible_experiment(db, user, experiment_id).measurements


@router.post("/{experiment_id}/submit-review", response_model=ExperimentOut)
def submit_review(experiment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    exp = get_owned_experiment(db, user, experiment_id)
    exp.review_status = "Submitted"
    write_audit(db, user_id=user.id, action="submit_review", resource_type="experiment",
                resource_id=exp.id, metadata={})
    db.commit()
    db.refresh(exp)
    return _enrich(exp)


@router.post("/{experiment_id}/review", response_model=ExperimentOut)
def review(experiment_id: int, payload: ReviewIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("Reviewer", "Administrator"):
        raise HTTPException(403, "Reviewer role required")
    exp = get_visible_experiment(db, user, experiment_id)
    exp.review_status = "Reviewed" if payload.approved else "Draft"
    write_audit(db, user_id=user.id, action="review", resource_type="experiment",
                resource_id=exp.id, metadata={"approved": payload.approved, "new_status": exp.review_status})
    db.commit()
    db.refresh(exp)
    return _enrich(exp)


# ── Version history ───────────────────────────────────────────────────────────

@router.get("/{experiment_id}/versions", response_model=list[ExperimentVersionOut])
def list_versions(experiment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return all version snapshots for an experiment, newest first."""
    get_visible_experiment(db, user, experiment_id)  # access check
    rows = db.scalars(
        select(ExperimentVersion)
        .where(ExperimentVersion.experiment_id == experiment_id)
        .order_by(ExperimentVersion.version.desc())
    ).all()
    return rows


# ── Audit log (Reviewer/Administrator only) ───────────────────────────────────

@router.get("/audit-log/entries", response_model=list[AuditLogOut])
def get_audit_log(
    resource_type: str | None = None,
    resource_id: int | None = None,
    limit: int = Query(50, le=200),
    offset: int = 0,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return audit log entries.  Restricted to Reviewer and Administrator."""
    if user.role not in ("Reviewer", "Administrator"):
        raise HTTPException(403, "Reviewer role required")
    from app.models import AuditLog
    stmt = select(AuditLog)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if resource_id is not None:
        stmt = stmt.where(AuditLog.resource_id == resource_id)
    stmt = stmt.order_by(AuditLog.timestamp.desc()).limit(limit).offset(offset)
    return db.scalars(stmt).all()

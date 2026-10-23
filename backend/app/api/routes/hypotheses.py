from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.limiter import limiter, rate_limit_by_user
from app.db.session import get_db
from app.models import Hypothesis, HypothesisAnalysis, User
from app.schemas import AnalysisOut, DesignOut, HypothesisCreate, HypothesisOut
from app.services.audit_service import write_audit
from app.services.experiment_design_service import design_experiment
from app.services.hypothesis_service import analysis_out, analyze_hypothesis

router = APIRouter(prefix="/hypotheses", tags=["hypotheses"])


def _own(db: Session, user: User, hypothesis_id: int) -> Hypothesis:
    h = db.get(Hypothesis, hypothesis_id)
    if not h or h.owner_id != user.id:
        raise HTTPException(404, "Hypothesis not found")
    return h


@router.post("", response_model=HypothesisOut, status_code=201)
def create_hypothesis(payload: HypothesisCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    h = Hypothesis(**payload.model_dump(), owner_id=user.id)
    db.add(h)
    db.flush()
    write_audit(db, user_id=user.id, action="create", resource_type="hypothesis",
                resource_id=h.id, metadata={"title": h.title})
    db.commit()
    db.refresh(h)
    return h


@router.get("", response_model=list[HypothesisOut])
def list_hypotheses(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return db.scalars(select(Hypothesis).where(Hypothesis.owner_id == user.id).order_by(Hypothesis.created_at.desc())).all()


@router.get("/{hypothesis_id}", response_model=HypothesisOut)
def get_hypothesis(hypothesis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _own(db, user, hypothesis_id)


@router.post("/{hypothesis_id}/analyze", response_model=AnalysisOut)
@limiter.limit("10/minute", key_func=rate_limit_by_user)
def analyze(request: Request, hypothesis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    h = _own(db, user, hypothesis_id)
    result = analyze_hypothesis(db, user, h)
    write_audit(db, user_id=user.id, action="analyze", resource_type="hypothesis",
                resource_id=h.id, metadata={"analysis_version": result.analysis_version})
    db.commit()
    return analysis_out(db, user, result)


@router.get("/{hypothesis_id}/analyses", response_model=list[AnalysisOut])
def list_analyses(hypothesis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    h = _own(db, user, hypothesis_id)
    rows = db.scalars(
        select(HypothesisAnalysis).where(HypothesisAnalysis.hypothesis_id == h.id).order_by(HypothesisAnalysis.analysis_version.desc())
    ).all()
    return [analysis_out(db, user, a) for a in rows]


@router.post("/{hypothesis_id}/design-experiment", response_model=DesignOut)
@limiter.limit("10/minute", key_func=rate_limit_by_user)
def design(request: Request, hypothesis_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    h = _own(db, user, hypothesis_id)
    latest = db.scalars(
        select(HypothesisAnalysis).where(HypothesisAnalysis.hypothesis_id == h.id).order_by(HypothesisAnalysis.analysis_version.desc())
    ).first()
    write_audit(db, user_id=user.id, action="design_experiment", resource_type="hypothesis",
                resource_id=h.id, metadata={})
    db.commit()
    return design_experiment(h, latest)

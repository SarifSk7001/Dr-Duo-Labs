from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.experiments import _enrich
from app.db.session import get_db
from app.models import User
from app.schemas import ExperimentOut, SearchHit
from app.services.search_service import hybrid_search

router = APIRouter(prefix="/search", tags=["search"])


class SearchHitOut(BaseModel):
    experiment: ExperimentOut
    score: float
    reason: str


@router.get("/experiments", response_model=list[SearchHitOut])
def search_experiments(
    q: str = "",
    domain: str | None = None,
    outcome: str | None = None,
    limit: int = Query(10, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    hits = hybrid_search(db, user, q=q, domain=domain, outcome=outcome, limit=limit)
    return [
        SearchHitOut(experiment=_enrich(h["experiment"]), score=h["score"], reason=h["reason"])
        for h in hits
    ]

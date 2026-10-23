"""Duplicate-detection endpoint.

POST /api/v1/experiments/similar

Takes a partial experiment description (title + hypothesis text) and returns
the top-3 semantically similar existing experiments visible to the user.
Used by the form to warn "similar to EXP-004 (contradicted)" before saving.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Experiment, User
from app.services.access import visible_filter
from app.services.embedding_service import embed_text

router = APIRouter(prefix="/experiments", tags=["experiments"])


class SimilarIn(BaseModel):
    title: str = ""
    hypothesis_text: str = ""
    domain: str = ""
    top_k: int = 3


class SimilarHit(BaseModel):
    id: int
    code: str
    title: str
    outcome: str
    review_status: str
    similarity: float    # 0–1, higher = more similar


@router.post("/similar", response_model=list[SimilarHit])
def find_similar(
    payload: SimilarIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return up to top_k experiments most similar to the submitted description."""
    query_text = f"{payload.title}\n{payload.domain}\n{payload.hypothesis_text}".strip()
    if not query_text:
        return []

    query_vec = embed_text(query_text)

    dist_col = Experiment.embedding.cosine_distance(query_vec)
    stmt = (
        select(Experiment, dist_col.label("dist"))
        .where(
            visible_filter(user),
            Experiment.review_status != "Archived",
            Experiment.embedding.is_not(None),
        )
        .order_by(dist_col)
        .limit(payload.top_k + 5)  # fetch a few extra to filter self if needed
    )
    rows = db.execute(stmt).all()

    hits = []
    for exp, dist in rows:
        sim = round(max(0.0, 1.0 - float(dist)), 3)
        if sim < 0.3:          # below threshold — not meaningfully similar
            continue
        hits.append(SimilarHit(
            id=exp.id,
            code=exp.code,
            title=exp.title,
            outcome=exp.outcome,
            review_status=exp.review_status,
            similarity=sim,
        ))

    return hits[: payload.top_k]

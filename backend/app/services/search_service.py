"""Hybrid retrieval: pgvector cosine similarity + keyword overlap, with access control."""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Experiment, User
from app.services.access import visible_filter
from app.services.embedding_service import embed_text, experiment_text

STOP = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "does", "will", "can", "than", "into"}


def tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]{3,}", text.lower())) - STOP


def hybrid_search(
    db: Session, user: User, q: str = "", domain: str | None = None, outcome: str | None = None, limit: int = 10
) -> list[dict]:
    stmt = select(Experiment).where(visible_filter(user), Experiment.review_status != "Archived")
    if domain:
        stmt = stmt.where(Experiment.domain.ilike(f"%{domain}%"))
    if outcome:
        stmt = stmt.where(Experiment.outcome == outcome)

    if not q.strip():
        rows = db.scalars(stmt.order_by(Experiment.created_at.desc()).limit(limit)).all()
        return [{"experiment": e, "score": 0.0, "reason": "Most recent"} for e in rows]

    dist = Experiment.embedding.cosine_distance(embed_text(q))
    rows = db.execute(
        stmt.where(Experiment.embedding.is_not(None)).add_columns(dist.label("dist")).order_by(dist).limit(limit * 3)
    ).all()

    q_tokens = tokens(q)
    hits = []
    for exp, d in rows:
        matched = sorted(q_tokens & tokens(experiment_text(exp)))
        keyword = len(matched) / len(q_tokens) if q_tokens else 0.0
        sim = max(0.0, 1.0 - float(d))
        reason = f"semantic similarity {sim:.2f}"
        if matched:
            reason += f"; keyword matches: {', '.join(matched[:6])}"
        hits.append({"experiment": exp, "score": round(0.7 * sim + 0.3 * keyword, 4), "reason": reason})
    hits.sort(key=lambda h: h["score"], reverse=True)
    return hits[:limit]

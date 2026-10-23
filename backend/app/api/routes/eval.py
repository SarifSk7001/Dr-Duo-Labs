"""Evaluation endpoint.

Computes two metrics on a fixed internal test set:

1. Precision@5 — keyword-only vs hybrid search.
   For each test query, we rank results by each strategy, then count how many
   of the top-5 results are "relevant" (query tokens overlap ≥ 1 with the
   experiment's keyword tokens).  We average across all queries.

2. AI evidence reference validation rate.
   For each HypothesisAnalysis, we count how many evidence IDs in the critique
   actually resolve to a visible experiment (validated) vs were hallucinated or
   deleted (dropped_refs).  The rate is validated / (validated + dropped).
"""

import re
from collections import defaultdict

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Experiment, HypothesisAnalysis, User
from app.services.access import visible_filter
from app.services.embedding_service import embed_text, experiment_text
from app.services.search_service import STOP, tokens

router = APIRouter(prefix="/eval", tags=["evaluation"])

# ---------------------------------------------------------------------------
# Test queries — deliberately diverse to exercise both retrieval modes.
# In a production setting, a separate labelled dataset would be used.
# ---------------------------------------------------------------------------
TEST_QUERIES = [
    "temperature effect on reaction rate",
    "sample size statistical power",
    "control group placebo",
    "hypothesis falsification",
    "measurement error calibration",
    "reproducibility replication",
    "confounding variable design",
    "outcome metric evaluation",
    "intervention treatment comparison",
    "baseline pre-test post-test",
]


def _keyword_search(db: Session, user: User, q: str, limit: int = 5) -> list[Experiment]:
    """Return top-``limit`` results by keyword overlap only (no vector)."""
    stmt = select(Experiment).where(visible_filter(user), Experiment.review_status != "Archived")
    all_exps = db.scalars(stmt).all()
    q_tokens = tokens(q)
    if not q_tokens:
        return all_exps[:limit]
    scored = []
    for e in all_exps:
        kw = len(q_tokens & tokens(experiment_text(e))) / len(q_tokens)
        scored.append((e, kw))
    scored.sort(key=lambda x: x[1], reverse=True)
    return [e for e, _ in scored[:limit]]


def _hybrid_search_ids(db: Session, user: User, q: str, limit: int = 5) -> list[int]:
    """Return experiment IDs from hybrid search (reuses service)."""
    from app.services.search_service import hybrid_search
    hits = hybrid_search(db, user, q=q, limit=limit)
    return [h["experiment"].id for h in hits]


def _is_relevant(exp: Experiment, q: str) -> bool:
    """A result is considered relevant if it shares at least one keyword with the query."""
    return bool(tokens(q) & tokens(experiment_text(exp)))


class EvalOut(BaseModel):
    keyword_precision_at_5: float
    hybrid_precision_at_5: float
    ai_evidence_validation_rate: float
    ai_total_refs: int
    ai_validated_refs: int
    ai_dropped_refs: int
    queries_evaluated: int
    note: str


@router.get("", response_model=EvalOut)
def evaluate(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Run evaluation metrics and return a summary."""

    # ── Precision@5 ───────────────────────────────────────────────────────────
    kw_precisions = []
    hy_precisions = []

    for q in TEST_QUERIES:
        kw_results = _keyword_search(db, user, q, limit=5)
        relevant_kw = sum(1 for e in kw_results if _is_relevant(e, q))
        kw_precisions.append(relevant_kw / max(len(kw_results), 1))

        hy_ids = _hybrid_search_ids(db, user, q, limit=5)
        hy_exps = [db.get(Experiment, i) for i in hy_ids if db.get(Experiment, i)]
        relevant_hy = sum(1 for e in hy_exps if _is_relevant(e, q))
        hy_precisions.append(relevant_hy / max(len(hy_exps), 1))

    kw_p5 = round(sum(kw_precisions) / max(len(kw_precisions), 1), 4)
    hy_p5 = round(sum(hy_precisions) / max(len(hy_precisions), 1), 4)

    # ── AI evidence validation rate ───────────────────────────────────────────
    analyses = db.scalars(select(HypothesisAnalysis)).all()
    total_validated = 0
    total_dropped = 0
    for a in analyses:
        # evidence_ids stored as list of experiment IDs (int or str)
        ev_ids = [int(x) for x in (a.evidence_ids or []) if str(x).isdigit()]
        for eid in ev_ids:
            exp = db.get(Experiment, eid)
            if exp and exp.review_status != "Archived":
                total_validated += 1
            else:
                total_dropped += 1
        total_dropped += a.dropped_refs  # already-counted drops from service layer

    total_refs = total_validated + total_dropped
    val_rate = round(total_validated / total_refs, 4) if total_refs else 0.0

    return EvalOut(
        keyword_precision_at_5=kw_p5,
        hybrid_precision_at_5=hy_p5,
        ai_evidence_validation_rate=val_rate,
        ai_total_refs=total_refs,
        ai_validated_refs=total_validated,
        ai_dropped_refs=total_dropped,
        queries_evaluated=len(TEST_QUERIES),
        note=(
            "Precision@5 is computed on a fixed internal test-query set using keyword-overlap "
            "as a relevance proxy.  For a rigorous evaluation, replace TEST_QUERIES with a "
            "labelled gold-standard set."
        ),
    )

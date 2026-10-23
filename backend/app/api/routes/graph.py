"""Graph data endpoint.

Returns all nodes (experiments + hypotheses) and edges (experiment_relationships +
hypothesis linkages) visible to the requesting user, ready for frontend rendering.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import Experiment, ExperimentRelationship, Hypothesis, User
from app.services.access import visible_filter

router = APIRouter(prefix="/graph", tags=["graph"])


class GraphNode(BaseModel):
    id: str          # "exp-{id}" or "hyp-{id}"
    label: str
    kind: str        # "experiment" | "hypothesis"
    outcome: str | None = None
    review_status: str | None = None


class GraphEdge(BaseModel):
    source: str      # node id
    target: str      # node id
    kind: str        # "follow_up_of" | "hypothesis_link"


class GraphOut(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


@router.get("", response_model=GraphOut)
def get_graph(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Return all visible experiments/hypotheses as a node-edge graph."""

    # ── Nodes ─────────────────────────────────────────────────────────────────
    exps = db.scalars(
        select(Experiment).where(visible_filter(user), Experiment.review_status != "Archived")
    ).all()
    hyps = db.scalars(
        select(Hypothesis).where(Hypothesis.owner_id == user.id)
    ).all()

    nodes: list[GraphNode] = []
    exp_ids: set[int] = set()

    for e in exps:
        nodes.append(GraphNode(
            id=f"exp-{e.id}",
            label=e.code,
            kind="experiment",
            outcome=e.outcome,
            review_status=e.review_status,
        ))
        exp_ids.add(e.id)

    for h in hyps:
        nodes.append(GraphNode(
            id=f"hyp-{h.id}",
            label=h.title[:40] + ("…" if len(h.title) > 40 else ""),
            kind="hypothesis",
        ))

    # ── Edges ─────────────────────────────────────────────────────────────────
    edges: list[GraphEdge] = []

    # experiment → experiment follow-up links
    rels = db.scalars(select(ExperimentRelationship)).all()
    for r in rels:
        if r.source_experiment_id in exp_ids and r.target_experiment_id in exp_ids:
            edges.append(GraphEdge(
                source=f"exp-{r.source_experiment_id}",
                target=f"exp-{r.target_experiment_id}",
                kind=r.relationship_type,
            ))

    # experiment → hypothesis links (where experiment.hypothesis_id is set)
    hyp_ids = {h.id for h in hyps}
    for e in exps:
        if e.hypothesis_id and e.hypothesis_id in hyp_ids:
            edges.append(GraphEdge(
                source=f"exp-{e.id}",
                target=f"hyp-{e.hypothesis_id}",
                kind="hypothesis_link",
            ))

    return GraphOut(nodes=nodes, edges=edges)

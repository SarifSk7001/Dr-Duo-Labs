from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Experiment, User


def visible_filter(user: User):
    """Record-level access: public records, or records the user owns."""
    return or_(Experiment.visibility == "public", Experiment.owner_id == user.id)


def get_visible_experiment(db: Session, user: User, experiment_id: int) -> Experiment:
    exp = db.get(Experiment, experiment_id)
    if not exp or not (exp.visibility == "public" or exp.owner_id == user.id):
        raise HTTPException(404, "Experiment not found")
    return exp


def get_owned_experiment(db: Session, user: User, experiment_id: int) -> Experiment:
    exp = get_visible_experiment(db, user, experiment_id)
    if exp.owner_id != user.id:
        raise HTTPException(403, "Only the owner can change this experiment")
    return exp

"""Embeddings via IBM Granite embedding models on watsonx.ai.

Without credentials, a deterministic hashing embedding is used so the demo runs offline.
Do not mix both kinds in one database: run `python -m app.seed --reindex` after changing mode.
"""
import hashlib
import json
import math
import re
from functools import lru_cache

from app.core.config import settings


def watsonx_enabled() -> bool:
    return bool(settings.watsonx_api_key and settings.watsonx_project_id)


def experiment_text(e) -> str:
    parts = [
        e.title, e.domain, e.research_question, e.hypothesis_text, e.methodology,
        e.results_summary, e.limitations,
        json.dumps(e.conditions or {}), json.dumps(e.variables or {}),
    ]
    return "\n".join(p for p in parts if p)


def _fallback_embedding(text: str) -> list[float]:
    vec = [0.0] * settings.embedding_dim
    for tok in re.findall(r"[a-z0-9]{3,}", text.lower()):
        h = int(hashlib.md5(tok.encode()).hexdigest(), 16)
        vec[h % settings.embedding_dim] += 1.0 if (h >> 8) % 2 else -1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


@lru_cache(maxsize=1)
def _client():
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import Embeddings

    creds = Credentials(url=settings.watsonx_url, api_key=settings.watsonx_api_key)
    return Embeddings(model_id=settings.embedding_model_id, credentials=creds, project_id=settings.watsonx_project_id)


def embed_text(text: str) -> list[float]:
    text = text[:2000]
    if not watsonx_enabled():
        return _fallback_embedding(text)
    vec = _client().embed_documents(texts=[text])[0]
    if len(vec) != settings.embedding_dim:
        raise RuntimeError(f"Embedding size {len(vec)} != EMBEDDING_DIM {settings.embedding_dim}")
    return vec

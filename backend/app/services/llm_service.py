"""IBM Granite on watsonx.ai, returning validated JSON."""
import json
from functools import lru_cache
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.services.embedding_service import watsonx_enabled

T = TypeVar("T", bound=BaseModel)


class LLMError(Exception):
    pass


@lru_cache(maxsize=1)
def _model():
    from ibm_watsonx_ai import Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference

    creds = Credentials(url=settings.watsonx_url, api_key=settings.watsonx_api_key)
    return ModelInference(
        model_id=settings.granite_model_id,
        credentials=creds,
        project_id=settings.watsonx_project_id,
        params={"decoding_method": "greedy", "max_new_tokens": 1800, "repetition_penalty": 1.05},
    )


def extract_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("No JSON object found")
    return json.loads(text[start : end + 1])


def generate_validated(prompt: str, schema: type[T], attempts: int = 2) -> T:
    last = None
    for _ in range(attempts):
        try:
            raw = _model().generate_text(prompt=prompt)
            return schema.model_validate(extract_json(raw))
        except (ValueError, ValidationError) as exc:  # bad JSON: retry once
            last = exc
        except Exception as exc:  # network / auth / quota
            raise LLMError(str(exc)) from exc
    raise LLMError(f"Model did not return valid JSON: {last}")


def llm_enabled() -> bool:
    return watsonx_enabled()

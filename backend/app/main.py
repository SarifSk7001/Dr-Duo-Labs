from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.routes import auth, eval, experiments, external, files, graph, hypotheses, search, similar, stats
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import init_db


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Experiment Exchange + Hypothesia", version="0.1.0", lifespan=lifespan)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = getattr(exc, "retry_after", 60)
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                f"Too many requests. Please wait {retry_after} second(s) before trying again."
            )
        },
        headers={"Retry-After": str(retry_after)},
    )


# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (auth.router, experiments.router, files.router, similar.router, search.router,
          hypotheses.router, eval.router, stats.router, graph.router, external.router):
    app.include_router(r, prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}

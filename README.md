# Experiment Exchange + Hypothesia

Searchable experiment repository (including failed and inconclusive results) with an AI hypothesis critique and
experiment planner, powered by IBM Granite on watsonx.ai.

Stack: React + Vite + Tailwind, FastAPI, PostgreSQL + pgvector, Pydantic, IBM Granite (watsonx.ai), Docker.

## Run with Docker

```bash
cp .env.example .env          # add WATSONX_API_KEY and WATSONX_PROJECT_ID for Granite
docker compose up --build
docker compose exec backend python -m app.seed
```

- App: http://localhost:5173
- API docs: http://localhost:8000/docs
- Demo login after seeding: `demo@example.com` / `demo12345`

## Run locally without Docker

```bash
# database: Postgres 16 with pgvector, e.g.
docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=experiment_exchange pgvector/pgvector:pg16

cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/experiment_exchange
python -m app.seed
uvicorn app.main:app --reload

cd ../frontend && npm install && npm run dev
```

## Offline demo mode

With no watsonx credentials the app still runs end to end: embeddings use a deterministic hashing fallback and the
critique/design use a clearly labelled heuristic template. Switching modes (or embedding models) changes vector
values, so run `python -m app.seed --reindex` afterwards. `EMBEDDING_DIM` must match the embedding model's output size.
Check the model IDs in `.env.example` against the models enabled in your watsonx.ai project.

## External literature search

The Repository page includes an **External literature** panel that searches OpenAlex and arXiv for published papers
relevant to a query. Results are clearly labelled as published literature (not verified experiments) and are cached
locally to save API budget.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `EXTERNAL_SEARCH_ENABLED` | `true` | Set `false` to hide the feature entirely (endpoints return 404). |
| `OPENALEX_API_KEY` | *(empty)* | Your email address — required for the OpenAlex polite pool. Free, no registration. Leave blank to disable OpenAlex (arXiv still works). |
| `EXTERNAL_CONTACT_EMAIL` | `admin@example.com` | Sent in `User-Agent` to all external providers. |
| `EXTERNAL_CACHE_HOURS` | `24` | Reuse a cached query result for this many hours before re-fetching. |
| `EXTERNAL_TIMEOUT_SECONDS` | `10` | HTTP timeout for calls to external providers. |

### Security

* Only two fixed API base URLs are ever called (`https://api.openalex.org/works` and `http://export.arxiv.org/api/query`).
  No user-supplied or arbitrary URLs are fetched (prevents SSRF).
* All fetched text is HTML-stripped before storage and before display.
* Abstracts are hard-truncated to 2 000 characters; full text and PDFs are never downloaded or stored.
* External results are **never** mixed into the experiment list; they appear in their own clearly labelled section.
* Per-user rate limiting: 10 external search requests per minute (in-memory; one process only — set `REDIS_URL` to scale).

### Database migration

The external-search tables (`external_sources`, `external_queries`) are created by Alembic migration `0003_external_sources`.

```bash
cd backend
alembic upgrade head   # runs automatically at startup too
```

If the database already exists at migration `0002_evidence_files`, only the new migration runs.

## The loop

1. Find experiments (hybrid pgvector + keyword search, with a reason for each hit).
2. (Optional) Search external literature and import a paper as a draft record.
3. Save a hypothesis in the Hypothesis lab and challenge it. Granite sees only retrieved, access-checked records
   (delimited as untrusted data), and the server removes any evidence ID that was not retrieved.
4. Design the next experiment, edit it, and save it as a draft linked to the hypothesis.
5. Record the result. Saving re-embeds the record so it is searchable immediately.

## Tests

```bash
cd backend && pytest
```

## Known gaps (MVP)

Visibility is private or public; group-restricted records are not built.
Promote a user to Reviewer/Administrator with SQL: `UPDATE users SET role='Reviewer' WHERE email='...';`
Sample data is synthetic and labelled as such.
In-memory rate limiting only works for a single worker process; set `REDIS_URL` in the limiter config to scale.

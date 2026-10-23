# Architecture

## System overview

```
Browser (React + Vite)
     │  HTTP/JSON  Bearer JWT
     ▼
FastAPI (Uvicorn)  ──────────────────────────────────────────────────────────
 ├── /api/v1/auth              JWT issue / verify
 ├── /api/v1/experiments       CRUD + review + audit + versions
 ├── /api/v1/hypotheses        Granite critique + experiment design
 ├── /api/v1/search            Hybrid pgvector + keyword
 ├── /api/v1/search/external   External literature (OpenAlex / arXiv)
 ├── /api/v1/external/{id}     Cached external source detail
 ├── /api/v1/stats             Sample-size / power calculator
 ├── /api/v1/graph             Knowledge graph
 └── /api/v1/eval              Retrieval evaluation
     │
     ├── PostgreSQL 16 + pgvector
     │    tables: users, experiments, measurements, experiment_relationships,
     │            hypotheses, hypothesis_analyses,
     │            audit_logs, experiment_versions, evidence_files,
     │            external_sources, external_queries
     │
     └── IBM watsonx.ai (optional)
          Granite 3 8B instruct  — hypothesis critique, experiment design,
                                   field extraction (Phase C)
          Granite embedding 278M — vector embeddings (768-dim)
```

## Data model

### Experiments
- `experiments` — core record; `embedding` is a 768-dim pgvector column
- `measurements` — numerical and text observations linked to an experiment
- `experiment_relationships` — directed follow-up links between experiments
- `evidence_files` — binary evidence (CSV, PDF, image) stored as `bytea`
- `experiment_versions` — pre-update snapshots for version history
- `audit_logs` — immutable event log (create, update, archive, review, analyse, design)

### Hypotheses
- `hypotheses` — user-authored hypothesis statements
- `hypothesis_analyses` — Granite critique results stored as JSONB

### External literature cache
- `external_sources` — one row per paper fetched from OpenAlex or arXiv.
  Stores only metadata + abstract (max 2 000 chars). No full text, no PDFs.
  `source + external_id` is unique.
- `external_queries` — maps a normalised query string to a list of
  `external_sources.id` values fetched at a given time.
  Rows younger than `EXTERNAL_CACHE_HOURS` are served without a live API call.

### Users
- `users` — accounts with roles: Researcher (default), Reviewer, Administrator

## Request flow: external literature search

```
User clicks "Search external sources"
     │
     ▼
GET /api/v1/search/external?q=<query>&source=all
     │
     ├── rate-limit check (10/min per user, in-memory slowapi)
     │
     ├── settings.external_search_enabled == false → 404
     │
     ├── normalise query → look up ExternalQuery younger than EXTERNAL_CACHE_HOURS
     │     hit  → return ExternalSource rows (cached: true)
     │     miss → call provider(s)
     │               OpenAlex: GET https://api.openalex.org/works?search=…
     │               arXiv:    GET http://export.arxiv.org/api/query?search_query=…
     │             HTML-strip + truncate all text
     │             upsert into external_sources (unique on source+external_id)
     │             write ExternalQuery cache row
     │             return results (cached: false)
     │
     └── return list[ExternalSourceOut]
             code, source, title, abstract, authors, year, doi, url,
             retrieved_at, cached
```

## Security model

### Access control
- All API endpoints require a valid JWT (except `/auth/login` and `/auth/register`).
- Record-level visibility: `public` records are visible to all authenticated users;
  `private` records are visible only to their owner.
- Enforced in every query via `access.visible_filter(user)` — never post-hoc filtering.
- Reviewer / Administrator role required for audit log and review endpoints.

### External search security
- Only two fixed base URLs are ever called. No user-supplied URLs.
  This prevents Server-Side Request Forgery (SSRF).
- `defusedxml` is used for arXiv Atom parsing to prevent XXE attacks.
- All fetched text is HTML-stripped (regex + `defusedxml`) before storage.
- Abstracts are hard-truncated to 2 000 characters.
- External results are stored in separate tables and never surfaced as
  experiment records.
- Prompts that include external text wrap it in `<external_evidence>` tags
  with an explicit instruction to treat the content as data, not instructions
  (Phase C).

### AI output validation
- Granite's JSON output is parsed and validated with Pydantic before use.
- Every cited experiment ID is checked against the set of IDs that were
  actually retrieved and accessible to the user.  Invented or inaccessible
  IDs are silently dropped and counted in `dropped_refs`.

### Rate limiting
- Auth endpoints: 5 requests/minute per IP.
- Analyze and design endpoints: 10 requests/minute per user.
- External search: 10 requests/minute per user.
- All limits use `slowapi` (in-memory). For multi-process deployments replace
  the storage backend with Redis (documented in `core/limiter.py`).

### Audit trail
- `audit_logs` is append-only (no UPDATE or DELETE).
- Passwords, tokens, and API keys are never written to `metadata`.
- The `write_audit` helper scrubs forbidden field names before insert.

## Offline mode

When `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` are empty:
- Embeddings: deterministic hashing (`_fallback_embedding`)
- Critique: heuristic template (`offline_critique`)
- Experiment design: template-based response
- AI field extraction: returns a clear "needs watsonx credentials" message

External search works fully in offline mode (it does not use watsonx).

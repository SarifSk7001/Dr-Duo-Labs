# API Reference

All endpoints are under `/api/v1` and require a `Bearer` JWT token unless noted.

## Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account (rate-limited: 5/min per IP) |
| POST | `/auth/login` | Obtain JWT (rate-limited: 5/min per IP) |
| POST | `/auth/logout` | Stateless — client discards token |
| GET  | `/auth/me` | Current user profile |

## Experiments

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/experiments` | List visible experiments (filters: domain, outcome, mine) |
| POST   | `/experiments` | Create experiment |
| GET    | `/experiments/{id}` | Get experiment detail |
| PATCH  | `/experiments/{id}` | Update (owner only) |
| DELETE | `/experiments/{id}` | Archive (owner only) |
| POST   | `/experiments/{id}/measurements` | Add measurements |
| GET    | `/experiments/{id}/measurements` | List measurements |
| POST   | `/experiments/{id}/submit-review` | Submit for review (owner) |
| POST   | `/experiments/{id}/review` | Approve/reject (Reviewer/Administrator) |
| GET    | `/experiments/{id}/versions` | Version history |
| GET    | `/experiments/audit-log/entries` | Audit log (Reviewer/Administrator) |
| POST   | `/experiments/similar` | Duplicate detection (vector search) |

## Evidence files

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/experiments/{id}/files` | Upload evidence file (CSV/PDF/image ≤10 MB) |
| GET    | `/experiments/{id}/files` | List evidence files |
| GET    | `/experiments/{id}/files/{fid}/download` | Download raw file |
| GET    | `/experiments/{id}/files/{fid}/preview` | CSV preview (first 200 rows) |
| DELETE | `/experiments/{id}/files/{fid}` | Delete file (owner only) |

## Search

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/search/experiments?q=&domain=&outcome=&limit=` | Hybrid pgvector + keyword search |

## External literature search

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/search/external?q=&source=openalex\|arxiv\|all&limit=` | Search external providers (rate-limited: 10/min per user) |
| GET    | `/external/{id}` | Get a cached external source |
| POST   | `/external/{id}/import` | Import as a private experiment draft *(Phase B)* |
| POST   | `/external/{id}/extract` | AI field extraction *(Phase C)* |

**`source` parameter:**
- `openalex` — OpenAlex scholarly works API (requires `OPENALEX_API_KEY`)
- `arxiv` — arXiv preprints API (no key needed)
- `all` (default) — both providers; one failing does not prevent the other's results

**Response fields:** `id`, `code` (EXT-001 etc.), `source`, `external_id`, `doi`, `title`, `abstract`, `authors`, `year`, `url`, `retrieved_at`, `cached`.

**Errors:**
- `400` — missing `OPENALEX_API_KEY`
- `404` — `EXTERNAL_SEARCH_ENABLED=false`
- `429` — per-user rate limit exceeded (Retry-After header included)
- `502` — provider returned an error
- `504` — provider timed out

## Hypotheses

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/hypotheses` | Create hypothesis |
| GET    | `/hypotheses` | List own hypotheses |
| GET    | `/hypotheses/{id}` | Get hypothesis |
| POST   | `/hypotheses/{id}/analyze` | Run Granite critique (rate-limited: 10/min per user) |
| GET    | `/hypotheses/{id}/analyses` | List past analyses |
| POST   | `/hypotheses/{id}/design-experiment` | Generate experiment design (rate-limited) |

## Statistics

| Method | Path | Description |
|--------|------|-------------|
| POST   | `/stats/power` | Sample-size / power calculator |

## Graph

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/graph` | Knowledge graph nodes and edges |

## Evaluation

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/eval` | Retrieval evaluation: Precision@5, AI validation rate |

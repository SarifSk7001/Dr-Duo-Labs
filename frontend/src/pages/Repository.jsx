import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { DocBadge, ErrorNote, OutcomeBadge, Tag } from "../components/ui.jsx";
import { downloadFile, stamp, toCSV } from "../utils/download.js";

const OUTCOMES = ["supported", "contradicted", "inconclusive", "partially supported", "not completed"];

const EXP_COLUMNS = [
  { label: "Code",              get: (e) => e.code },
  { label: "Title",             get: (e) => e.title },
  { label: "Domain",            get: (e) => e.domain },
  { label: "Outcome",           get: (e) => e.outcome },
  { label: "Review status",     get: (e) => e.review_status },
  { label: "Visibility",        get: (e) => e.visibility },
  { label: "Sample size",       get: (e) => e.sample_size },
  { label: "Research question", get: (e) => e.research_question },
  { label: "Hypothesis",        get: (e) => e.hypothesis_text },
  { label: "Methodology",       get: (e) => e.methodology },
  { label: "Conditions",        get: (e) => e.conditions },
  { label: "Results summary",   get: (e) => e.results_summary },
  { label: "Limitations",       get: (e) => e.limitations },
  { label: "Created at",        get: (e) => e.created_at },
];

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate2">
      <path d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-ibm" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function Repository() {
  const [q, setQ] = useState("");
  const [domain, setDomain] = useState("");
  const [outcome, setOutcome] = useState("");
  const [hits, setHits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const search = async (e) => {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ q, limit: "20" });
      if (domain) params.set("domain", domain);
      if (outcome) params.set("outcome", outcome);
      setHits(await api.get(`/search/experiments?${params}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch every visible experiment (matching the domain/outcome filters), 100 per request.
  const downloadAll = async (format) => {
    setDownloading(true);
    setError("");
    try {
      const all = [];
      for (let offset = 0; ; offset += 100) {
        const params = new URLSearchParams({ limit: "100", offset: String(offset) });
        if (domain) params.set("domain", domain);
        if (outcome) params.set("outcome", outcome);
        const page = await api.get(`/experiments?${params}`);
        all.push(...page);
        if (page.length < 100) break;
      }
      if (format === "json") {
        downloadFile(`experiments-${stamp()}.json`, JSON.stringify(all, null, 2), "application/json");
      } else {
        downloadFile(`experiments-${stamp()}.csv`, toCSV(all, EXP_COLUMNS), "text/csv;charset=utf-8");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => { search(); }, []); // eslint-disable-line

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 transition-colors duration-150 hover:text-ibm">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Experiment repository</h2>
        <p className="mt-1 text-sm text-slate2">Search across all recorded experiments, including failed and inconclusive ones.</p>
      </div>

      <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
        <form onSubmit={search} className="space-y-3">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <SearchIcon />
            </span>
            <input
              className="input py-2.5 pl-9 pr-4 text-sm"
              placeholder="Describe a question or hypothesis…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search query"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input !w-44 text-sm"
              placeholder="Domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-label="Domain filter"
            />
            <select
              className="input !w-48 text-sm"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              aria-label="Outcome filter"
            >
              <option value="">Any outcome</option>
              {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
            </select>
            <button className="btn gap-2" disabled={loading}>
              {loading ? <Spinner /> : <SearchIcon />}
              Search
            </button>
          </div>

          <p className="text-xs text-slate2">
            Similar wording does not mean experiments are scientifically equivalent — compare their conditions.
          </p>
        </form>
      </div>

      <ErrorNote message={error} />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate2">
          <Spinner /> Searching…
        </div>
      )}

      {!loading && hits.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-rule bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bench">
            <SearchIcon />
          </div>
          <p className="text-sm font-medium text-ink">No experiments match.</p>
          <p className="mt-1 text-xs text-slate2">
            <Link className="text-ibm underline underline-offset-2" to="/experiments/new">Record the first one</Link> to get started.
          </p>
        </div>
      )}

      {!loading && hits.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate2">
              {hits.length} result{hits.length !== 1 ? "s" : ""} from your repository
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => downloadAll("csv")}
                disabled={downloading}
                className="btn-quiet !px-3 !py-1.5 !text-xs"
              >
                {downloading ? "Preparing…" : "Download all (CSV)"}
              </button>
              <button
                onClick={() => downloadAll("json")}
                disabled={downloading}
                className="btn-quiet !px-3 !py-1.5 !text-xs"
              >
                JSON
              </button>
            </div>
          </div>
          <ul className="space-y-3">
            {hits.map(({ experiment: e, reason }, idx) => (
              <li
                key={e.id}
                className="group rounded-xl border border-rule bg-white p-5 shadow-sm transition-all duration-200 hover:border-ibm/30 hover:shadow-md"
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] font-medium text-slate2">{e.code}</span>
                  <OutcomeBadge outcome={e.outcome} />
                  <Tag>{e.review_status}</Tag>
                  {e.is_sample && <Tag>sample</Tag>}
                  {e.provenance && (
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                      imported · {e.provenance.source}
                    </span>
                  )}
                  <DocBadge score={e.doc_score ?? 0} total={e.doc_total ?? 8} />
                </div>

                <Link
                  to={`/experiments/${e.id}`}
                  className="mt-2 block font-serif text-lg font-semibold leading-snug text-ink transition-colors duration-150 group-hover:text-ibm"
                >
                  {e.title}
                </Link>

                <p className="mt-1.5 line-clamp-2 text-sm text-slate2">{e.hypothesis_text}</p>

                <div className="mt-3 flex items-center justify-between border-t border-rule/60 pt-3">
                  <span className="text-xs text-slate2">{e.domain}</span>
                  <span className="text-xs text-slate2/70">Why shown: {e.reason ?? reason}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
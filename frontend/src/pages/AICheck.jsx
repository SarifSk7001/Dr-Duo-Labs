import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { Tag } from "../components/ui.jsx";
import { downloadFile, stamp, toCSV } from "../utils/download.js";

const SOURCE_LABELS = { openalex: "OpenAlex", arxiv: "arXiv" };
const SOURCE_COLOURS = {
  openalex: "bg-violet-50 text-violet-700 border-violet-200",
  arxiv:    "bg-sky-50 text-sky-700 border-sky-200",
};

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
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

function SourceBadge({ source }) {
  const cls = SOURCE_COLOURS[source] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {SOURCE_LABELS[source] || source}
    </span>
  );
}

function ExternalCard({ result }) {
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [err, setErr] = useState("");

  const abstract = result.abstract || "";
  const SHORT = 300;
  const truncated = abstract.length > SHORT && !expanded;
  const displayAbstract = truncated ? abstract.slice(0, SHORT).trimEnd() : abstract;

  const handleImport = async () => {
    setImporting(true); setErr("");
    try {
      const exp = await api.importExternal(result.id);
      setImported(exp.id);
    } catch (e) { setErr(e.message); }
    finally { setImporting(false); }
  };

  return (
    <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-medium text-slate2">{result.code}</span>
        <SourceBadge source={result.source} />
        {result.year && <Tag>{result.year}</Tag>}
        {result.cached && <span className="text-[10px] text-slate2/60 italic">cached</span>}
      </div>

      <a
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block font-serif text-base font-semibold leading-snug text-ink hover:text-ibm transition-colors"
      >
        {result.title}
      </a>

      {result.authors?.length > 0 && (
        <p className="mt-1 text-xs text-slate2 truncate">
          {result.authors.slice(0, 5).join(", ")}
          {result.authors.length > 5 && ` +${result.authors.length - 5} more`}
        </p>
      )}

      {abstract && (
        <div className="mt-2">
          <p className="text-sm text-slate2 leading-relaxed whitespace-pre-line">
            {displayAbstract}
            {truncated && "…"}
          </p>
          {abstract.length > SHORT && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="mt-1 text-xs font-semibold text-ibm hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule/60 pt-3">
        <div className="flex flex-wrap items-center gap-3">
          {result.doi && (
            <a
              href={`https://doi.org/${result.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-medium text-ibm hover:underline"
            >
              DOI: {result.doi}
            </a>
          )}
          <span className="text-[10px] text-slate2/60">
            Retrieved {new Date(result.retrieved_at).toLocaleDateString()}
          </span>
        </div>

        {imported ? (
          <Link to={`/experiments/${imported}`} className="text-xs font-semibold text-emerald-700 hover:underline">
            ✓ Imported — open draft →
          </Link>
        ) : (
          <button
            onClick={handleImport}
            disabled={importing}
            className="flex items-center gap-1.5 rounded-lg border border-rule px-3 py-1.5 text-xs font-semibold text-slate2 hover:border-ibm/40 hover:text-ibm transition disabled:opacity-50"
          >
            {importing ? <Spinner /> : null}
            {importing ? "Importing…" : "Import as draft"}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
    </div>
  );
}

const PAPER_COLUMNS = [
  { label: "Code",        get: (r) => r.code },
  { label: "Source",      get: (r) => r.source },
  { label: "Title",       get: (r) => r.title },
  { label: "Authors",     get: (r) => (r.authors || []).join("; ") },
  { label: "Year",        get: (r) => r.year },
  { label: "DOI",         get: (r) => r.doi },
  { label: "URL",         get: (r) => r.url },
  { label: "Abstract",    get: (r) => r.abstract },
  { label: "Retrieved at", get: (r) => r.retrieved_at },
];

export default function AICheck() {
  const [query, setQuery]     = useState("");
  const [source, setSource]   = useState("all");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  const search = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true); setError(""); setResults(null);
    try {
      setResults(await api.searchExternal({ q: query, source, limit: 10 }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 transition-colors duration-150 hover:text-ibm">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">AI check</h2>
        <p className="mt-1 text-sm text-slate2">
          Check your idea against published literature from OpenAlex and arXiv, and import a paper as a draft record.
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
        <div className="border-b border-amber-200 px-5 py-4">
          <h3 className="text-sm font-semibold text-amber-900">External literature</h3>
          <p className="mt-0.5 text-xs text-amber-800">
            <strong>Published literature. Not verified experiments.</strong>{" "}
            Published work is biased toward positive results.
            Results are metadata only — no full text is stored.
          </p>

          <form onSubmit={search} className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="input min-w-[12rem] flex-1 text-sm"
              placeholder="Search published papers, e.g. cache latency"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="External search query"
            />
            <select
              className="input !w-auto text-xs"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label="Source"
            >
              <option value="all">OpenAlex + arXiv</option>
              <option value="openalex">OpenAlex only</option>
              <option value="arxiv">arXiv only</option>
            </select>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-800 disabled:opacity-50"
            >
              {loading ? <Spinner /> : <SearchIcon />}
              {loading ? "Searching…" : "Search external sources"}
            </button>
          </form>
        </div>

        <div className="space-y-4 p-5">
          {results === null && !loading && !error && (
            <p className="text-sm italic text-amber-800/70">
              Type a topic above and press Enter to search OpenAlex and arXiv. Results are cached for 24 hours.
            </p>
          )}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-amber-800">
              <Spinner /> Searching published literature…
            </div>
          )}

          {!loading && results !== null && results.length === 0 && !error && (
            <p className="text-sm italic text-amber-800/70">No published papers found for this query. Try different keywords.</p>
          )}

          {!loading && results !== null && results.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-amber-800">
                  {results.length} published paper{results.length !== 1 ? "s" : ""} — AI-generated content may be present.
                  Verify independently before use.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadFile(`papers-${stamp()}.csv`, toCSV(results, PAPER_COLUMNS), "text/csv;charset=utf-8")}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    Download all (CSV)
                  </button>
                  <button
                    onClick={() => downloadFile(`papers-${stamp()}.json`, JSON.stringify(results, null, 2), "application/json")}
                    className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                  >
                    JSON
                  </button>
                </div>
              </div>
              {results.map((r) => (
                <ExternalCard key={r.id} result={r} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

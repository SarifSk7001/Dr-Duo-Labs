import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { ErrorNote } from "../components/ui.jsx";

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-ibm" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

function MetricCard({ label, value, description, highlight }) {
  const pct = typeof value === "number" ? `${Math.round(value * 100)}%` : value;
  const colour =
    value >= 0.8 ? "text-emerald-600" :
    value >= 0.5 ? "text-amber-500" :
    "text-red-500";
  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm ${highlight ? "border-ibm/30 ring-1 ring-ibm/10" : "border-rule"}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate2/70">{label}</p>
      <p className={`mt-2 text-4xl font-extrabold tracking-tight ${colour}`}>{pct}</p>
      {description && <p className="mt-2 text-xs leading-relaxed text-slate2">{description}</p>}
    </div>
  );
}

function GaugeBar({ value, label, colour }) {
  const pct = Math.round(value * 100);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate2">{label}</span>
        <span className="text-xs font-semibold text-ink">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Evaluation() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/eval")
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">System evaluation</h2>
        <p className="mt-1 text-sm text-slate2">
          Live retrieval quality metrics and AI evidence validation rates computed against the current repository.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate2">
          <Spinner /> Running evaluation…
        </div>
      )}

      <ErrorNote message={error} />

      {data && (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Keyword P@5"
              value={data.keyword_precision_at_5}
              description="Fraction of top-5 keyword results matching query terms"
            />
            <MetricCard
              label="Hybrid P@5"
              value={data.hybrid_precision_at_5}
              description="Fraction of top-5 hybrid results matching query terms"
              highlight
            />
            <MetricCard
              label="AI Ref. Validation"
              value={data.ai_evidence_validation_rate}
              description="Share of AI-cited experiments that resolve to real records"
            />
          </div>

          {/* Comparison bar */}
          <div className="rounded-xl border border-rule bg-white p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-ink">Keyword vs hybrid retrieval</h3>
            <GaugeBar value={data.keyword_precision_at_5} label="Keyword-only Precision@5" colour="bg-slate-400" />
            <GaugeBar value={data.hybrid_precision_at_5} label="Hybrid Precision@5" colour="bg-ibm" />
            {data.hybrid_precision_at_5 > data.keyword_precision_at_5 && (
              <p className="text-xs text-emerald-700 font-medium">
                Hybrid retrieval outperforms keyword search by{" "}
                {Math.round((data.hybrid_precision_at_5 - data.keyword_precision_at_5) * 100)} pp on this test set.
              </p>
            )}
            {data.hybrid_precision_at_5 <= data.keyword_precision_at_5 && (
              <p className="text-xs text-amber-700 font-medium">
                Keyword and hybrid performance are similar on the current repository.
                Hybrid advantage grows with repository size.
              </p>
            )}
          </div>

          {/* AI reference counts */}
          <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-ink">AI evidence references</h3>
            <div className="grid grid-cols-3 divide-x divide-rule text-center">
              {[
                { label: "Total refs", value: data.ai_total_refs, colour: "text-ink" },
                { label: "Validated", value: data.ai_validated_refs, colour: "text-emerald-600" },
                { label: "Dropped", value: data.ai_dropped_refs, colour: "text-red-500" },
              ].map(({ label, value, colour }) => (
                <div key={label} className="py-2">
                  <p className={`text-2xl font-extrabold ${colour}`}>{value}</p>
                  <p className="text-[10px] font-medium text-slate2 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
            {data.ai_total_refs === 0 && (
              <p className="mt-3 text-xs italic text-slate2">No hypothesis analyses yet — run an analysis in the Hypothesis Lab to populate this metric.</p>
            )}
          </div>

          {/* Methodology note */}
          <div className="rounded-xl border border-amber-200/70 bg-amber-50 p-5 text-xs text-amber-800 leading-relaxed space-y-2">
            <p className="font-semibold text-amber-900">Methodology</p>
            <p>
              Precision@5 is measured on {data.queries_evaluated} fixed test queries using keyword-token overlap as a relevance proxy.
              A result is considered relevant if it shares at least one non-stopword token with the query.
            </p>
            <p>
              For a rigorous evaluation, replace the internal test set with a labelled gold-standard query–document set and use domain-expert relevance judgements.
            </p>
            <p className="italic">{data.note}</p>
          </div>
        </>
      )}
    </div>
  );
}

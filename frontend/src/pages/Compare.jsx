import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api.js";
import { ErrorNote, OutcomeBadge, Tag } from "../components/ui.jsx";

const COMPARE_FIELDS = [
  { key: "domain",            label: "Domain" },
  { key: "outcome",           label: "Outcome" },
  { key: "review_status",     label: "Review status" },
  { key: "sample_size",       label: "Sample size" },
  { key: "research_question", label: "Research question" },
  { key: "hypothesis_text",   label: "Hypothesis" },
  { key: "methodology",       label: "Methodology" },
  { key: "conditions",        label: "Conditions" },
  { key: "results_summary",   label: "Results" },
  { key: "limitations",       label: "Limitations" },
];

const code = (id) => `EXP-${String(id).padStart(3, "0")}`;

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-ibm" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

function cellVal(val) {
  if (val === null || val === undefined || val === "") return <span className="italic text-slate2/50">—</span>;
  if (typeof val === "object") {
    const entries = Object.entries(val);
    if (entries.length === 0) return <span className="italic text-slate2/50">—</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {entries.map(([k, v]) => (
          <span key={k} className="rounded bg-bench px-1.5 py-0.5 text-[11px] text-slate2">
            {k.replace(/_/g, " ")}: {String(v)}
          </span>
        ))}
      </div>
    );
  }
  return <span>{String(val)}</span>;
}

function isDifferent(experiments, key) {
  if (experiments.length < 2) return false;
  const vals = experiments.map((e) => JSON.stringify(e[key]));
  return new Set(vals).size > 1;
}

export default function Compare() {
  // All loaded experiments list (for selection)
  const [allExps, setAllExps] = useState([]);
  const [selected, setSelected] = useState([]);  // IDs (up to 3)
  const [experiments, setExperiments] = useState([]);  // full objects
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");

  // Load experiment list on mount
  useEffect(() => {
    api.get("/experiments?limit=100")
      .then((exps) => setAllExps(exps))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const runCompare = async () => {
    if (selected.length < 2) return;
    setComparing(true);
    setError("");
    try {
      const results = await Promise.all(selected.map((id) => api.get(`/experiments/${id}`)));
      setExperiments(results);
    } catch (e) {
      setError(e.message);
    } finally {
      setComparing(false);
    }
  };

  const colBg = ["bg-white", "bg-blue-50/50", "bg-violet-50/50"];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Compare experiments</h2>
        <p className="mt-1 text-sm text-slate2">
          Select 2 or 3 experiments to view conditions, sample size and outcomes side by side.
          Differing fields are highlighted — similar wording does not mean scientific equivalence.
        </p>
      </div>

      {/* Selection panel */}
      <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-ink">
            Select experiments
            <span className="ml-2 text-xs font-normal text-slate2">({selected.length}/3 selected)</span>
          </p>
          <button
            onClick={runCompare}
            disabled={selected.length < 2 || comparing}
            className="flex items-center gap-1.5 rounded-lg bg-ibm px-4 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-ibmdark disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {comparing ? <><Spinner /> Comparing…</> : "Compare"}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate2"><Spinner /> Loading…</div>
        ) : (
          <div className="max-h-56 overflow-y-auto divide-y divide-rule/50">
            {allExps.length === 0 && (
              <p className="py-4 text-sm italic text-slate2">No experiments available.</p>
            )}
            {allExps.map((exp) => {
              const isSelected = selected.includes(exp.id);
              const selIdx = selected.indexOf(exp.id);
              return (
                <label
                  key={exp.id}
                  className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-bench/50 ${isSelected ? "bg-ibm/5" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-ibm"
                    checked={isSelected}
                    disabled={!isSelected && selected.length >= 3}
                    onChange={() => toggleSelect(exp.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{exp.title}</p>
                    <p className="text-[11px] text-slate2">{code(exp.id)} · {exp.domain} · {exp.outcome}</p>
                  </div>
                  {isSelected && (
                    <span className="shrink-0 rounded-full bg-ibm px-1.5 py-0.5 text-[10px] font-bold text-white">
                      #{selIdx + 1}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
      </div>

      <ErrorNote message={error} />

      {/* Comparison table */}
      {experiments.length >= 2 && (
        <div className="overflow-x-auto rounded-xl border border-rule shadow-sm">
          <table className="w-full border-collapse text-sm">
            {/* Header row */}
            <thead>
              <tr>
                <th className="sticky left-0 border-b border-rule bg-bench px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate2 w-36">
                  Field
                </th>
                {experiments.map((exp, i) => (
                  <th key={exp.id} className={`border-b border-rule px-4 py-3 text-left ${colBg[i]}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-slate2">{exp.code}</span>
                      <OutcomeBadge outcome={exp.outcome} />
                    </div>
                    <Link
                      to={`/experiments/${exp.id}`}
                      className="mt-1 block text-sm font-semibold text-ibm hover:underline leading-snug"
                    >
                      {exp.title}
                    </Link>
                    <p className="mt-0.5 text-[11px] text-slate2">{exp.domain}</p>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FIELDS.map(({ key, label }) => {
                const diff = isDifferent(experiments, key);
                return (
                  <tr key={key} className={diff ? "bg-amber-50/60" : ""}>
                    <td className="sticky left-0 border-b border-rule/40 bg-inherit px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70 whitespace-nowrap">
                      {label}
                      {diff && (
                        <span className="ml-1.5 rounded-full bg-amber-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 tracking-wider">
                          differs
                        </span>
                      )}
                    </td>
                    {experiments.map((exp, i) => (
                      <td
                        key={exp.id}
                        className={`border-b border-rule/40 px-4 py-3 align-top text-sm text-ink ${colBg[i]} ${diff ? "font-medium" : ""}`}
                      >
                        {key === "outcome"
                          ? <OutcomeBadge outcome={exp[key]} />
                          : cellVal(exp[key])
                        }
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {experiments.length >= 2 && (
        <p className="rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>Reminder:</strong> Similar wording in the hypothesis or title does not mean experiments are scientifically
          equivalent. Always compare conditions, methodology, and sample size before drawing conclusions
          about why two experiments gave different results.
        </p>
      )}
    </div>
  );
}

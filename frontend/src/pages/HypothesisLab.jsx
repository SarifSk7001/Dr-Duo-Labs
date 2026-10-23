import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, parseKV } from "../services/api.js";
import { ErrorNote, Field, List } from "../components/ui.jsx";

const idFromCode = (c) => Number(String(c).replace(/\D/g, ""));

function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate2">
      <svg className="h-4 w-4 animate-spin text-ibm" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
      </svg>
      {label}
    </span>
  );
}

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-rule bg-white shadow-sm">
      <div className="border-b border-rule px-5 py-4">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate2">{subtitle}</p>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function EvidenceList({ title, items }) {
  if (!items?.length) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold tracking-tight text-ink">{title}</h4>
      <ul className="space-y-1.5 text-sm">
        {items.map((x, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ibm/50" aria-hidden="true" />
            <span>
              <Link className="font-medium text-ibm underline underline-offset-2" to={`/experiments/${idFromCode(x.experiment_id)}`}>{x.experiment_id}</Link>
              {" — "}{x.reason}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function WarnBanner({ children }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm1 6.25a1 1 0 1 0-2 0 1 1 0 0 0 2 0Z" />
      </svg>
      {children}
    </div>
  );
}

export default function HypothesisLab() {
  const navigate = useNavigate();
  const [list, setList] = useState([]);
  const [sel, setSel] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [design, setDesign] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [f, setF] = useState({ title: "", statement: "", research_question: "", expected_effect: "", variables: "", constraints: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const loadList = async () => { try { setList(await api.get("/hypotheses")); } catch (e) { setError(e.message); } };
  useEffect(() => { loadList(); }, []);

  const choose = async (h) => {
    setSel(h); setDesign(null); setAnalysis(null); setError("");
    try { const all = await api.get(`/hypotheses/${h.id}/analyses`); setAnalysis(all[0] || null); } catch (e) { setError(e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const h = await api.post("/hypotheses", { ...f, variables: parseKV(f.variables), constraints: parseKV(f.constraints) });
      setF({ title: "", statement: "", research_question: "", expected_effect: "", variables: "", constraints: "" });
      await loadList();
      choose(h);
    } catch (err) { setError(err.message); }
  };

  const run = async (label, fn) => {
    setBusy(label); setError("");
    try { await fn(); } catch (err) { setError(err.message); } finally { setBusy(""); }
  };

  const analyze = () => run("analyze", async () => setAnalysis(await api.post(`/hypotheses/${sel.id}/analyze`)));
  const makeDesign = () => run("design", async () => setDesign(await api.post(`/hypotheses/${sel.id}/design-experiment`)));

  const useDesign = () => navigate("/experiments/new", {
    state: {
      hypothesis_id: sel.id,
      prefill: {
        title: design.title,
        research_question: sel.research_question,
        hypothesis_text: sel.statement,
        methodology: [design.objective, ...design.procedure.map((s, i) => `${i + 1}. ${s}`)].join("\n"),
        variables: Object.fromEntries(design.independent_variables.map((v) => [v, "independent"])),
        limitations: design.limitations.join(" "),
      },
    },
  });

  const c = analysis?.critique;

  return (
    <div className="mx-auto grid max-w-6xl gap-5 px-4 py-8 md:px-8 lg:grid-cols-[22rem_1fr]">
      <div className="lg:col-span-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors duration-150">
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
          Back to dashboard
        </Link>
      </div>

      {/* Left column */}
      <div className="space-y-5">

        {/* New hypothesis form */}
        <SectionCard title="New hypothesis">
          <form onSubmit={create} className="space-y-3">
            <Field label="Title"><input className="input" required value={f.title} onChange={set("title")} /></Field>
            <Field label="Hypothesis" hint="Include a measurable prediction."><textarea className="input" required minLength={10} rows={3} value={f.statement} onChange={set("statement")} /></Field>
            <Field label="Research question"><textarea className="input" rows={2} value={f.research_question} onChange={set("research_question")} /></Field>
            <Field label="Expected effect"><input className="input" value={f.expected_effect} onChange={set("expected_effect")} /></Field>
            <Field label="Variables" hint="One per line, as name: role"><textarea className="input" rows={2} value={f.variables} onChange={set("variables")} /></Field>
            <Field label="Constraints" hint="Budget, duration, equipment"><textarea className="input" rows={2} value={f.constraints} onChange={set("constraints")} /></Field>
            <button className="btn w-full">Save hypothesis</button>
          </form>
        </SectionCard>

        {/* Saved hypotheses list */}
        <SectionCard title="Your hypotheses">
          {list.length === 0
            ? <p className="text-sm text-slate2/70 italic">None yet. Save one above.</p>
            : (
              <ul className="space-y-0.5">
                {list.map((h) => (
                  <li key={h.id}>
                    <button
                      onClick={() => choose(h)}
                      className={`w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all duration-150 ${
                        sel?.id === h.id
                          ? "bg-ibm/10 text-ibm"
                          : "text-ink hover:bg-bench hover:text-ibm"
                      }`}
                    >
                      {h.title}
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </SectionCard>
      </div>

      {/* Right column */}
      <div className="space-y-5">
        <ErrorNote message={error} />

        {!sel && (
          <div className="rounded-xl border border-dashed border-rule bg-white p-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-bench">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-slate2">
                <path fillRule="evenodd" d="M9.664 1.319a.75.75 0 0 1 .672 0 41.059 41.059 0 0 1 8.198 5.424.75.75 0 0 1-.254 1.285 31.372 31.372 0 0 0-7.86 3.83.75.75 0 0 1-.84 0 31.508 31.508 0 0 0-2.08-1.287V9.394c0-.244.116-.463.315-.6a35.504 35.504 0 0 1 4.083-2.802.75.75 0 0 0-.832-1.244A37.003 37.003 0 0 0 7.498 7.57V7.29a.75.75 0 0 1 .394-.663l1.772-.99ZM10 10.25a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0V11a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-ink">Select a hypothesis</p>
            <p className="mt-1 text-xs text-slate2">Save or pick a hypothesis from the left to test it against recorded experiments.</p>
          </div>
        )}

        {sel && (
          <>
            {/* Hypothesis header card */}
            <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold tracking-tight">{sel.title}</h2>
              <p className="mt-1.5 text-sm text-slate2 leading-relaxed">{sel.statement}</p>
              <div className="mt-4 flex flex-wrap gap-2.5 border-t border-rule pt-4">
                <button
                  className="btn gap-1.5"
                  disabled={!!busy}
                  onClick={analyze}
                >
                  {busy === "analyze" ? <Spinner label="Analyzing…" /> : (analysis ? "Re-run analysis" : "Challenge this hypothesis")}
                </button>
                <button
                  className="btn-quiet gap-1.5"
                  disabled={!!busy || !analysis}
                  onClick={makeDesign}
                >
                  {busy === "design" ? <Spinner label="Designing…" /> : "Design the next experiment"}
                </button>
              </div>
            </div>

            {/* Critique */}
            {c && (
              <SectionCard
                title="AI Critique"
                subtitle={`Model: ${analysis.model_info}. AI suggestions only — not verified findings.`}
              >
                <div className="space-y-4">
                  {c.hypothesis_summary && <p className="text-sm leading-relaxed text-ink">{c.hypothesis_summary}</p>}
                  <List title="Assumptions" items={c.assumptions} />
                  <List title="Possible confounders" items={c.potential_confounders} />
                  <List title="Alternative explanations" items={c.alternative_explanations} />
                  <EvidenceList title="Supporting evidence" items={c.supporting_evidence} />
                  <EvidenceList title="Contradicting evidence" items={c.contradicting_evidence} />
                  <List title="Evidence gaps" items={c.evidence_gaps} />
                  {c.proposed_tests.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold tracking-tight text-ink">Suggested tests</h4>
                      <ul className="space-y-2.5">
                        {c.proposed_tests.map((t, i) => (
                          <li key={i} className="rounded-lg border border-rule bg-bench p-4 text-sm">
                            <p className="font-semibold text-ink">{t.objective}</p>
                            <p className="mt-1 text-slate2"><span className="font-medium text-ink/70">Controls:</span> {t.controls.join(", ") || "none listed"}</p>
                            <p className="text-slate2"><span className="font-medium text-ink/70">Measure:</span> {t.measurements.join(", ") || "none listed"}</p>
                            <p className="mt-1 text-slate2">{t.interpretation}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <List title="Uncertainty" items={c.uncertainty_notes} />
                  {analysis.evidence.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold tracking-tight text-ink">Records retrieved for this analysis</h4>
                      <ul className="space-y-1 text-sm text-slate2">
                        {analysis.evidence.map((e) => (
                          <li key={e.id}>
                            <Link className="font-medium text-ibm underline underline-offset-2" to={`/experiments/${e.id}`}>{e.code}</Link>
                            {" — "}{e.title} <span className="text-slate2/60">({e.outcome})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Proposed experiment */}
            {design && (
              <SectionCard title="Proposed experiment">
                <div className="space-y-4">
                  <WarnBanner>A qualified person must review this plan before it is run, especially for hazardous work.</WarnBanner>
                  <div>
                    <p className="font-semibold text-sm text-ink">{design.title}</p>
                    <p className="mt-1 text-sm text-slate2 leading-relaxed">{design.objective}</p>
                  </div>
                  <List title="Competing explanations" items={design.competing_explanations} />
                  <List title="What changes" items={design.independent_variables} />
                  <List title="What stays controlled" items={design.controls} />
                  <List title="What is measured" items={design.measurements} />
                  <List title="Procedure" items={design.procedure} />
                  {design.sample_size_notes && <p className="text-sm text-slate2"><span className="font-medium text-ink">Sample size.</span> {design.sample_size_notes}</p>}
                  <List title="Evaluation metrics" items={design.evaluation_metrics} />
                  <List title="What each outcome would imply" items={design.outcome_interpretations} />
                  <List title="Limitations" items={design.limitations} />
                  <List title="Safety" items={design.safety_notes} />
                  <div className="border-t border-rule pt-4">
                    <button className="btn" onClick={useDesign}>Edit and save as draft experiment</button>
                  </div>
                </div>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}

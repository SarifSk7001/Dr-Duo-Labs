import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api, kvToText, parseKV } from "../services/api.js";
import { ErrorNote, Field } from "../components/ui.jsx";

const OUTCOME_DOT = {
  supported:            "bg-emerald-500",
  contradicted:         "bg-red-500",
  inconclusive:         "bg-amber-400",
  "partially supported":"bg-sky-400",
  "not completed":      "bg-slate-300",
};

const OUTCOMES = ["not completed", "supported", "contradicted", "inconclusive", "partially supported"];

function SectionCard({ title, subtitle, children }) {
  return (
    <div className="rounded-xl border border-rule bg-white shadow-sm">
      <div className="border-b border-rule px-5 py-4">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate2">{subtitle}</p>}
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

// ── Power calculator panel ─────────────────────────────────────────────────────

const EFFECT_PRESETS = [
  { label: "Small (d=0.2)",  value: 0.2 },
  { label: "Medium (d=0.5)", value: 0.5 },
  { label: "Large (d=0.8)",  value: 0.8 },
];

/** Mini SVG power curve: achieved power vs n from 5 to nMax. */
function PowerCurve({ effectSize, alpha }) {
  const points = [];
  const nMax = 400;
  for (let n = 2; n <= nMax; n += 4) {
    // Normal approximation: power ≈ Φ( d*√(n/2) − zα/2 )
    const za = 1.96; // α=0.05
    const stat = effectSize * Math.sqrt(n / 2) - za;
    const p = 0.5 * (1 + Math.sign(stat) * (1 - Math.exp(-0.717 * stat - 0.416 * stat * stat)));
    points.push({ n, p: Math.min(0.9999, Math.max(0, p)) });
  }
  const W = 300; const H = 80;
  const xs = (n) => ((n - 2) / (nMax - 2)) * W;
  const ys = (p) => H - p * H;
  const d = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${xs(pt.n).toFixed(1)} ${ys(pt.p).toFixed(1)}`).join(" ");
  // 80% power line
  const n80line = xs(Math.max(2, (1.96 + 0.842) ** 2 * 2 / effectSize ** 2));

  return (
    <svg width={W} height={H + 18} viewBox={`0 0 ${W} ${H + 18}`} className="w-full">
      {/* Axes */}
      <line x1={0} y1={H} x2={W} y2={H} stroke="#e5e7eb" strokeWidth="1" />
      {/* 80% power dashed line */}
      <line x1={0} y1={ys(0.8)} x2={W} y2={ys(0.8)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - 2} y={ys(0.8) - 3} fontSize="8" fill="#f59e0b" textAnchor="end">80%</text>
      {/* Curve */}
      <path d={d} fill="none" stroke="#3b82d4" strokeWidth="1.5" />
      {/* Labels */}
      <text x={2} y={H + 13} fontSize="8" fill="#57606a">n=2</text>
      <text x={W / 2} y={H + 13} fontSize="8" fill="#57606a" textAnchor="middle">n per group</text>
      <text x={W - 2} y={H + 13} fontSize="8" fill="#57606a" textAnchor="end">n={nMax}</text>
    </svg>
  );
}

function PowerCalculator({ onApply }) {
  const [open, setOpen] = useState(false);
  const [testType, setTestType] = useState("t_test");
  const [effectSize, setEffectSize] = useState("0.5");
  const [p1, setP1] = useState("0.5");
  const [p2, setP2] = useState("0.6");
  const [alpha, setAlpha] = useState("0.05");
  const [powerTarget, setPowerTarget] = useState("0.80");
  const [nInput, setNInput] = useState("");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const calculate = async () => {
    setBusy(true); setErr(""); setResult(null);
    try {
      const body = {
        test_type: testType,
        alpha: parseFloat(alpha),
        power: parseFloat(powerTarget),
        n: nInput ? parseInt(nInput) : null,
        ...(testType === "t_test"
          ? { effect_size: parseFloat(effectSize) }
          : { p1: parseFloat(p1), p2: parseFloat(p2) }),
      };
      const data = await api.post("/stats/power", body);
      setResult(data);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-rule bg-white shadow-sm">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between border-b border-rule px-5 py-4 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Sample-size &amp; power calculator
          </h3>
          <p className="mt-0.5 text-xs text-slate2">
            Calculate the n needed to detect a given effect, or the power achieved by your planned n.
          </p>
        </div>
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-4 w-4 shrink-0 text-slate2 transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="p-5 space-y-4">
          {/* Test type */}
          <div className="flex gap-3">
            {["t_test", "proportion"].map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  name="test_type"
                  value={t}
                  checked={testType === t}
                  onChange={() => setTestType(t)}
                  className="accent-ibm"
                />
                {t === "t_test" ? "Two-sample t-test (continuous)" : "Two-proportion test (binary)"}
              </label>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {testType === "t_test" ? (
              <Field label="Effect size (Cohen's d)">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    type="number" min="0.01" step="0.01"
                    value={effectSize}
                    onChange={(e) => setEffectSize(e.target.value)}
                  />
                  <select
                    className="input !w-auto text-xs"
                    onChange={(e) => setEffectSize(e.target.value)}
                    value=""
                  >
                    <option value="" disabled>Preset</option>
                    {EFFECT_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </Field>
            ) : (
              <>
                <Field label="Baseline proportion p₁">
                  <input className="input" type="number" min="0.01" max="0.99" step="0.01" value={p1} onChange={(e) => setP1(e.target.value)} />
                </Field>
                <Field label="Treatment proportion p₂">
                  <input className="input" type="number" min="0.01" max="0.99" step="0.01" value={p2} onChange={(e) => setP2(e.target.value)} />
                </Field>
              </>
            )}

            <Field label="Significance level α">
              <select className="input" value={alpha} onChange={(e) => setAlpha(e.target.value)}>
                <option value="0.01">0.01</option>
                <option value="0.05">0.05</option>
                <option value="0.10">0.10</option>
              </select>
            </Field>

            <Field label="Target power (1 − β)">
              <select className="input" value={powerTarget} onChange={(e) => setPowerTarget(e.target.value)}>
                <option value="0.80">80%</option>
                <option value="0.90">90%</option>
                <option value="0.95">95%</option>
              </select>
            </Field>

            <Field label="Planned n per group (optional — compute achieved power)">
              <input
                className="input"
                type="number" min="2" placeholder="Leave blank to compute n"
                value={nInput} onChange={(e) => setNInput(e.target.value)}
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={calculate}
            disabled={busy}
            className="btn gap-2"
          >
            {busy && <Spinner />}
            {busy ? "Calculating…" : "Calculate"}
          </button>

          {err && <ErrorNote message={err} />}

          {result && (
            <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">{result.note}</p>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                {[
                  ["Effect size", result.effect_size],
                  ["α", result.alpha],
                  result.n_per_group !== null
                    ? ["n per group", result.n_per_group]
                    : ["Achieved power", `${(result.achieved_power * 100).toFixed(1)}%`],
                  ["Engine", result.scipy_used ? "SciPy" : "Normal approx."],
                ].map(([label, val]) => (
                  <div key={label} className="rounded bg-white/70 px-3 py-2 text-center">
                    <p className="font-bold text-ink">{val}</p>
                    <p className="text-slate2">{label}</p>
                  </div>
                ))}
              </div>

              {/* Power curve */}
              <div className="pt-1">
                <p className="mb-1 text-[10px] font-semibold text-slate2 uppercase tracking-wide">
                  Power curve (d = {result.effect_size}, α = {result.alpha})
                </p>
                <PowerCurve effectSize={result.effect_size} alpha={result.alpha} />
              </div>

              {/* Apply to form */}
              {result.n_per_group !== null && (
                <button
                  type="button"
                  onClick={() => onApply(result.n_per_group)}
                  className="btn-quiet text-xs"
                >
                  Use n = {result.n_per_group} as sample size
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function ExperimentForm() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [params] = useSearchParams();
  const pre = state?.prefill || {};
  const [f, setF] = useState({
    title: pre.title || "",
    domain: pre.domain || "software performance",
    research_question: pre.research_question || "",
    hypothesis_text: pre.hypothesis_text || "",
    methodology: pre.methodology || "",
    variables: kvToText(pre.variables),
    conditions: kvToText(pre.conditions),
    sample_size: pre.sample_size || "",
    outcome: pre.outcome || "not completed",
    results_summary: pre.results_summary || "",
    limitations: pre.limitations || "",
    visibility: "private",
  });
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [similar, setSimilar] = useState([]);   // duplicate warning hits
  const [warnDismissed, setWarnDismissed] = useState(false);
  const debounceRef = useRef(null);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Debounced duplicate check — fires 900 ms after title/hypothesis changes.
  useEffect(() => {
    if (warnDismissed) return;
    if (!f.title && !f.hypothesis_text) { setSimilar([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const hits = await api.post("/experiments/similar", {
          title: f.title,
          hypothesis_text: f.hypothesis_text,
          domain: f.domain,
          top_k: 3,
        });
        setSimilar(hits);
      } catch { /* ignore — warning is non-blocking */ }
    }, 900);
    return () => clearTimeout(debounceRef.current);
  }, [f.title, f.hypothesis_text, f.domain, warnDismissed]); // eslint-disable-line

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...f,
        variables: parseKV(f.variables),
        conditions: parseKV(f.conditions),
        sample_size: f.sample_size === "" ? null : Number(f.sample_size),
        parent_id: params.get("parent") ? Number(params.get("parent")) : null,
        hypothesis_id: state?.hypothesis_id || null,
      };
      const created = await api.post("/experiments", body);
      navigate(`/experiments/${created.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors duration-150">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      {/* Page header */}
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Record an experiment</h2>
        {params.get("parent") && (
          <p className="mt-1 text-sm text-slate2">
            This will be linked as a follow-up to{" "}
            <span className="font-mono font-medium text-ink">EXP-{String(params.get("parent")).padStart(3, "0")}</span>.
          </p>
        )}
      </div>

      {/* Design section */}
      <SectionCard title="Design" subtitle="Describe what you are testing and how.">
        <Field label="Title">
          <input className="input" required value={f.title} onChange={set("title")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Domain">
            <input className="input" required value={f.domain} onChange={set("domain")} />
          </Field>
          <Field label="Sample size">
            <input className="input" type="number" min="1" value={f.sample_size} onChange={set("sample_size")} />
          </Field>
        </div>
        <Field label="Research question">
          <textarea className="input" rows={2} value={f.research_question} onChange={set("research_question")} />
        </Field>
        <Field label="Hypothesis" hint="State a measurable prediction.">
          <textarea className="input" rows={2} value={f.hypothesis_text} onChange={set("hypothesis_text")} />
        </Field>
        <Field label="Method">
          <textarea className="input" rows={4} value={f.methodology} onChange={set("methodology")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Variables" hint="One per line, as name: role">
            <textarea className="input" rows={4} value={f.variables} onChange={set("variables")} />
          </Field>
          <Field label="Conditions" hint="One per line, as name: value">
            <textarea className="input" rows={4} value={f.conditions} onChange={set("conditions")} />
          </Field>
        </div>
      </SectionCard>

      {/* Duplicate warning banner */}
      {similar.length > 0 && !warnDismissed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-5 w-5 shrink-0 text-amber-500">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  Similar experiment{similar.length > 1 ? "s" : ""} already recorded
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Before saving, check whether these cover the same ground:
                </p>
                <ul className="mt-2 space-y-1.5">
                  {similar.map((hit) => (
                    <li key={hit.id} className="flex items-center gap-2 text-xs">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${OUTCOME_DOT[hit.outcome] ?? "bg-slate-300"}`} />
                      <a
                        href={`/experiments/${hit.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono font-medium text-amber-900 hover:underline"
                      >
                        {hit.code}
                      </a>
                      <span className="text-amber-800 truncate">{hit.title}</span>
                      <span className="shrink-0 rounded-full bg-amber-200/60 px-1.5 py-0.5 font-semibold capitalize text-amber-700">
                        {hit.outcome}
                      </span>
                      <span className="shrink-0 text-amber-600/70">{Math.round(hit.similarity * 100)}% similar</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setWarnDismissed(true)}
              className="shrink-0 rounded p-1 text-amber-600 hover:bg-amber-100 transition"
              aria-label="Dismiss"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Power calculator */}
      <PowerCalculator onApply={(n) => setF({ ...f, sample_size: String(n) })} />

      {/* Results section */}
      <SectionCard title="Results" subtitle="Record findings, or leave as 'not completed' for a draft.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outcome" hint="Your interpretation under the tested conditions, not a universal claim.">
            <select className="input" value={f.outcome} onChange={set("outcome")}>
              {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Who can see it">
            <select className="input" value={f.visibility} onChange={set("visibility")}>
              <option value="private">Only me</option>
              <option value="public">All users</option>
            </select>
          </Field>
        </div>
        <Field label="Results">
          <textarea className="input" rows={3} value={f.results_summary} onChange={set("results_summary")} />
        </Field>
        <Field label="Limitations">
          <textarea className="input" rows={3} value={f.limitations} onChange={set("limitations")} />
        </Field>
      </SectionCard>

      <ErrorNote message={error} />

      <div className="flex items-center gap-3">
        <button className="btn gap-2" disabled={busy}>
          {busy && <Spinner />}
          {busy ? "Saving…" : "Save experiment"}
        </button>
        <span className="text-xs text-slate2">You can update the result later.</span>
      </div>
    </form>
  );
}

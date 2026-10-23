import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, kvToText, parseKV, session } from "../services/api.js";
import { DocBadge, ErrorNote, Field, OutcomeBadge, Tag } from "../components/ui.jsx";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const OUTCOMES = ["not completed", "supported", "contradicted", "inconclusive", "partially supported"];
const code = (id) => `EXP-${String(id).padStart(3, "0")}`;

// Fields shown in the history diff view
const DIFFABLE_FIELDS = [
  "title", "domain", "research_question", "hypothesis_text", "methodology",
  "outcome", "results_summary", "limitations", "visibility", "review_status",
  "sample_size",
];

function InfoRow({ label, children }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr]">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate2/70">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <section className="rounded-xl border border-rule bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-rule px-5 py-3.5">
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
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

function NoticeBar({ message }) {
  if (!message) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 animate-in">
      <svg className="h-4 w-4 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm3.25 4.25a.75.75 0 0 0-1.06-1.06L6.75 7.64 5.81 6.7a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.06 0l3.94-3.94-.001-.059Z" />
      </svg>
      {message}
    </div>
  );
}

// ── History panel ─────────────────────────────────────────────────────────────

function FieldDiff({ label, prev, next }) {
  const changed = JSON.stringify(prev) !== JSON.stringify(next);
  return (
    <div className={`rounded-lg p-2 text-xs ${changed ? "bg-amber-50 border border-amber-200" : ""}`}>
      <span className="font-semibold text-slate2/70 uppercase tracking-wide">{label}</span>
      {changed ? (
        <div className="mt-0.5 flex flex-col gap-0.5">
          <span className="line-through text-red-600/80">{String(prev ?? "—")}</span>
          <span className="text-emerald-700 font-medium">{String(next ?? "—")}</span>
        </div>
      ) : (
        <div className="mt-0.5 text-ink/70">{String(prev ?? "—")}</div>
      )}
    </div>
  );
}

// versions[] is newest-first. Each snapshot captures the state BEFORE an edit.
// snap=versions[i] is a newer snapshot; nextSnap=versions[i+1] is the preceding (older) one.
// Diff direction: prev=nextSnap.snapshot (what it was before), next=snap.snapshot (what it became).
function VersionRow({ snap, nextSnap }) {
  const [open, setOpen] = useState(false);
  const date = new Date(snap.created_at).toLocaleString();
  const changedFields = nextSnap
    ? DIFFABLE_FIELDS.filter((f) => JSON.stringify(snap.snapshot[f]) !== JSON.stringify(nextSnap.snapshot[f]))
    : [];

  return (
    <div className="border-b border-rule/50 last:border-0">
      <button
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-bench/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-ibm/10 px-2 py-0.5 text-[10px] font-bold text-ibm">
            v{snap.version}
          </span>
          <span className="text-xs text-ink">{date}</span>
          {changedFields.length > 0 && (
            <span className="text-[10px] text-slate2">{changedFields.length} field{changedFields.length !== 1 ? "s" : ""} changed</span>
          )}
        </span>
        <svg
          viewBox="0 0 16 16"
          fill="currentColor"
          className={`h-3.5 w-3.5 text-slate2 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        >
          <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06L7.28 11.78a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4">
          {nextSnap ? (
            // prev = older state (nextSnap, versions[i+1]); next = what it changed to (snap, versions[i])
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {DIFFABLE_FIELDS.map((f) => (
                <FieldDiff key={f} label={f.replace(/_/g, " ")} prev={nextSnap.snapshot[f]} next={snap.snapshot[f]} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate2 italic">Initial version — no prior state to compare.</p>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ experimentId }) {
  const [versions, setVersions] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.versions(experimentId)
      .then(setVersions)
      .catch((e) => setErr(e.message));
  }, [experimentId]);

  if (err) return <ErrorNote message={err} />;
  if (!versions) return (
    <div className="flex items-center gap-2 text-sm text-slate2 py-4 px-4">
      <Spinner /> Loading history…
    </div>
  );
  if (versions.length === 0) {
    return <p className="px-4 py-4 text-sm text-slate2 italic">No version history yet — history is recorded on every update.</p>;
  }

  return (
    <div>
      {versions.map((v, i) => (
        <VersionRow
          key={v.id}
          snap={v}
          nextSnap={versions[i + 1] || null}
        />
      ))}
    </div>
  );
}

// ── Evidence panel ────────────────────────────────────────────────────────────

const ICON = {
  "text/csv":        "📊",
  "application/pdf": "📄",
  "image/png":       "🖼",
  "image/jpeg":      "🖼",
  "image/gif":       "🖼",
  "image/webp":      "🖼",
};

/** Inline SVG bar chart for a single numeric column from CSV preview data. */
function CsvBarChart({ columns, rows }) {
  // Pick the first numeric column as the value axis; use row index as x-axis.
  const numCol = columns.findIndex((_, ci) =>
    rows.slice(0, 5).every((r) => r[ci] !== "" && !isNaN(Number(r[ci])))
  );
  if (numCol === -1) {
    return <p className="text-xs italic text-slate2">No numeric column detected for chart.</p>;
  }
  const values = rows.map((r) => Number(r[numCol]));
  const maxV = Math.max(...values, 0.001);
  const barW = Math.max(4, Math.floor(360 / values.length) - 2);
  const h = 80;
  const svgW = values.length * (barW + 2) + 4;
  return (
    <div className="mt-3 overflow-x-auto">
      <p className="mb-1 text-[10px] text-slate2">
        Column: <strong>{columns[numCol]}</strong> — {values.length} rows
      </p>
      <svg width={svgW} height={h + 14} viewBox={`0 0 ${svgW} ${h + 14}`}>
        {values.map((v, i) => {
          const bh = Math.max(1, (v / maxV) * h);
          const x = 2 + i * (barW + 2);
          const y = h - bh;
          return <rect key={i} x={x} y={y} width={barW} height={bh} fill="#3b82d4" rx="1" />;
        })}
        <text x={2} y={h + 13} fontSize="8" fill="#57606a">{values[0]}</text>
        <text x={svgW - 2} y={h + 13} fontSize="8" fill="#57606a" textAnchor="end">
          {values[values.length - 1]}
        </text>
      </svg>
    </div>
  );
}

function EvidencePanel({ experimentId, mine }) {
  const [files, setFiles]       = useState([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr]           = useState("");
  const [preview, setPreview]   = useState(null);   // { fileId, data }
  const inputRef                = useRef();

  const reload = () =>
    api.listFiles(experimentId).then(setFiles).catch((e) => setErr(e.message));

  useEffect(() => { reload(); }, [experimentId]); // eslint-disable-line

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api.uploadFile(experimentId, fd);
      await reload();
    } catch (ex) { setErr(ex.message); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  };

  const handleDelete = async (fileId) => {
    setErr("");
    try { await api.deleteFile(experimentId, fileId); await reload(); }
    catch (ex) { setErr(ex.message); }
  };

  const togglePreview = async (f) => {
    if (preview?.fileId === f.id) { setPreview(null); return; }
    if (f.mime_type !== "text/csv") return;
    try {
      const data = await api.previewCsv(experimentId, f.id);
      setPreview({ fileId: f.id, data });
    } catch (ex) { setErr(ex.message); }
  };

  const downloadUrl = (f) =>
    `${BASE_URL}/experiments/${experimentId}/files/${f.id}/download`;

  const fmtSize = (b) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-3">
      {err && <ErrorNote message={err} />}

      {files.length === 0 && (
        <p className="text-sm italic text-slate2/70">No evidence files attached.</p>
      )}

      {files.map((f) => (
        <div key={f.id} className="rounded-lg border border-rule bg-bench/40 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-base">{ICON[f.mime_type] ?? "📁"}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{f.filename}</p>
                <p className="text-[10px] text-slate2">{f.mime_type} · {fmtSize(f.size_bytes)}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {f.mime_type === "text/csv" && (
                <button
                  onClick={() => togglePreview(f)}
                  className="text-[11px] font-semibold text-ibm hover:underline"
                >
                  {preview?.fileId === f.id ? "Hide" : "Preview"}
                </button>
              )}
              <a
                href={downloadUrl(f)}
                className="text-[11px] font-semibold text-slate2 hover:text-ibm"
                download={f.filename}
              >
                Download
              </a>
              {mine && (
                <button
                  onClick={() => handleDelete(f.id)}
                  className="text-[11px] font-semibold text-red-500 hover:text-red-700"
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {/* CSV preview */}
          {preview?.fileId === f.id && preview.data && (
            <div className="mt-3 overflow-x-auto">
              <CsvBarChart columns={preview.data.columns} rows={preview.data.rows} />
              <p className="mt-2 text-[10px] text-slate2">
                Showing first {preview.data.rows.length} rows
                {preview.data.truncated ? " (file truncated)" : ""}.
              </p>
              <table className="mt-2 w-full text-left text-[11px]">
                <thead>
                  <tr className="border-b border-rule">
                    {preview.data.columns.map((c) => (
                      <th key={c} className="pb-1 pr-3 font-semibold text-slate2/70 uppercase tracking-wide">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.data.rows.slice(0, 10).map((row, i) => (
                    <tr key={i} className="border-b border-rule/30 hover:bg-bench/50">
                      {row.map((cell, ci) => (
                        <td key={ci} className="py-1 pr-3 text-ink">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {mine && (
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-rule px-4 py-3 text-sm text-slate2 transition hover:border-ibm/40 hover:text-ibm hover:bg-ibm/5">
          {uploading ? (
            <><Spinner /> Uploading…</>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                <path d="M7.25 10.25a.75.75 0 0 0 1.5 0V4.56l2.22 2.22a.75.75 0 1 0 1.06-1.06l-3.5-3.5a.75.75 0 0 0-1.06 0l-3.5 3.5a.75.75 0 0 0 1.06 1.06l2.22-2.22v5.69Z" />
                <path d="M3.5 9.75a.75.75 0 0 0-1.5 0V13A1.75 1.75 0 0 0 3.75 14.75h8.5A1.75 1.75 0 0 0 14 13V9.75a.75.75 0 0 0-1.5 0V13a.25.25 0 0 1-.25.25h-8.5a.25.25 0 0 1-.25-.25V9.75Z" />
              </svg>
              Attach evidence file (CSV, PDF, or image · max 10 MB)
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".csv,text/csv,.pdf,application/pdf,.png,.jpg,.jpeg,.gif,.webp,image/*"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExperimentDetail() {
  const { id } = useParams();
  const [e, setE] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState({ outcome: "not completed", results_summary: "", limitations: "" });
  const [m, setM] = useState({ variable_name: "", value: "", unit: "", trial_number: 1 });
  const [notice, setNotice] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailsNotice, setDetailsNotice] = useState("");
  const [draft, setDraft] = useState({ research_question: "", hypothesis_text: "", methodology: "", sample_size: "", conditions: "" });

  const load = async () => {
    try {
      const data = await api.get(`/experiments/${id}`);
      setE(data);
      setResult({ outcome: data.outcome, results_summary: data.results_summary, limitations: data.limitations });
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line

  if (error) return <ErrorNote message={error} />;
  if (!e) return (
    <div className="flex items-center gap-2 text-sm text-slate2">
      <Spinner /> Loading…
    </div>
  );
  const mine = e.owner_id === session.user?.id;

  const saveResult = async (ev) => {
    ev.preventDefault();
    setError(""); setNotice("");
    try {
      setE(await api.patch(`/experiments/${id}`, result));
      setNotice("Result saved and re-indexed. It is now searchable.");
    } catch (err) { setError(err.message); }
  };

  const startEdit = () => {
    setDraft({
      research_question: e.research_question || "",
      hypothesis_text: e.hypothesis_text || "",
      methodology: e.methodology || "",
      sample_size: e.sample_size ?? "",
      conditions: kvToText(e.conditions),
    });
    setError(""); setNotice(""); setDetailsNotice("");
    setEditing(true);
  };

  const saveDetails = async (ev) => {
    ev.preventDefault();
    setError(""); setNotice(""); setDetailsNotice("");
    try {
      const payload = {
        research_question: draft.research_question,
        hypothesis_text: draft.hypothesis_text,
        methodology: draft.methodology,
        conditions: parseKV(draft.conditions),
      };
      if (draft.sample_size !== "") payload.sample_size = Number(draft.sample_size);
      setE(await api.patch(`/experiments/${id}`, payload));
      setEditing(false);
      setDetailsNotice("Details saved and re-indexed. A new version was recorded.");
    } catch (err) { setError(err.message); }
  };

  const addMeasurement = async (ev) => {
    ev.preventDefault();
    setError("");
    try {
      const value = m.value !== "" && !isNaN(Number(m.value)) ? Number(m.value) : m.value;
      await api.post(`/experiments/${id}/measurements`, [{ ...m, value, trial_number: Number(m.trial_number) }]);
      setM({ variable_name: "", value: "", unit: "", trial_number: 1 });
      load();
    } catch (err) { setError(err.message); }
  };

  const submitReview = async () => {
    try { setE(await api.post(`/experiments/${id}/submit-review`)); } catch (err) { setError(err.message); }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors duration-150">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-medium text-slate2">{e.code}</span>
          <OutcomeBadge outcome={e.outcome} />
          <Tag>{e.review_status}</Tag>
          <Tag>{e.visibility}</Tag>
          {e.is_sample && <Tag>sample data</Tag>}
          <DocBadge score={e.doc_score ?? 0} total={e.doc_total ?? 8} />
          {e.provenance && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              Imported from {e.provenance.source === "openalex" ? "OpenAlex" : e.provenance.source === "arxiv" ? "arXiv" : e.provenance.source}
            </span>
          )}
        </div>
        <h2 className="mt-2 text-2xl leading-snug tracking-tight">{e.title}</h2>
        <p className="mt-1 text-sm text-slate2">{e.domain} · Version {e.version}</p>
        {/* Provenance link */}
        {e.provenance?.url && (
          <p className="mt-1.5 text-xs text-slate2">
            Source:{" "}
            <a
              href={e.provenance.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ibm underline underline-offset-2 hover:text-ibmdark"
            >
              {e.provenance.doi ? `doi:${e.provenance.doi}` : e.provenance.url}
            </a>
            {e.provenance.imported_at && (
              <span className="ml-2 text-slate2/60">
                · imported {new Date(e.provenance.imported_at).toLocaleDateString()}
              </span>
            )}
          </p>
        )}
        {e.provenance && (e.provenance.authors?.length > 0 || e.provenance.year) && (
          <p className="mt-1 text-xs text-slate2">
            {e.provenance.authors?.length > 0 && <>Authors: {e.provenance.authors.join(", ")}</>}
            {e.provenance.year && <span className="ml-2 text-slate2/70">· Published {e.provenance.year}</span>}
          </p>
        )}
      </div>

      {/* Details */}
      <SectionCard
        title="Experiment details"
        action={mine && !editing ? (
          <button type="button" onClick={startEdit} className="text-xs font-semibold text-ibm hover:underline">
            Edit details
          </button>
        ) : null}
      >
        {editing ? (
          <form onSubmit={saveDetails} className="space-y-4">
            <Field label="Research question">
              <textarea className="input" rows={2} value={draft.research_question} onChange={(x) => setDraft({ ...draft, research_question: x.target.value })} />
            </Field>
            <Field label="Hypothesis">
              <textarea className="input" rows={2} value={draft.hypothesis_text} onChange={(x) => setDraft({ ...draft, hypothesis_text: x.target.value })} />
            </Field>
            <Field label="Method">
              <textarea className="input" rows={4} value={draft.methodology} onChange={(x) => setDraft({ ...draft, methodology: x.target.value })} />
            </Field>
            <Field label="Sample size">
              <input className="input" type="number" min="1" step="1" value={draft.sample_size} onChange={(x) => setDraft({ ...draft, sample_size: x.target.value })} />
            </Field>
            <Field label="Conditions" hint="One per line, as name: value (for example temperature: 25)">
              <textarea className="input" rows={3} value={draft.conditions} onChange={(x) => setDraft({ ...draft, conditions: x.target.value })} />
            </Field>
            <div className="flex gap-2.5 border-t border-rule pt-4">
              <button className="btn">Save details</button>
              <button type="button" className="btn-quiet" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        ) : (
        <dl className="space-y-3.5">
          {detailsNotice && <NoticeBar message={detailsNotice} />}
          {mine && e.provenance && !e.research_question && !e.hypothesis_text && !e.methodology && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
              This draft was imported from a paper, so these fields start empty. Click <strong>Edit details</strong> to fill them in.
            </p>
          )}
          <InfoRow label="Research question">{e.research_question || <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          <InfoRow label="Hypothesis">{e.hypothesis_text || <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          <InfoRow label="Method">{e.methodology || <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          <InfoRow label="Sample size">{e.sample_size ?? <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          <InfoRow label="Conditions">
            {Object.keys(e.conditions).length === 0
              ? <span className="text-slate2/60 italic">Not recorded</span>
              : <div className="flex flex-wrap gap-1.5">{Object.entries(e.conditions).map(([k, v]) => <Tag key={k}>{k.replace(/_/g, " ")}: {String(v)}</Tag>)}</div>
            }
          </InfoRow>
          <InfoRow label="Results">{e.results_summary || <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          <InfoRow label="Limitations">{e.limitations || <span className="text-slate2/60 italic">Not recorded</span>}</InfoRow>
          {(e.parent_ids.length > 0 || e.follow_up_ids.length > 0) && (
            <InfoRow label="Related">
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {e.parent_ids.map((p) => <Link key={p} className="text-ibm underline underline-offset-2" to={`/experiments/${p}`}>follows {code(p)}</Link>)}
                {e.follow_up_ids.map((p) => <Link key={p} className="text-ibm underline underline-offset-2" to={`/experiments/${p}`}>followed by {code(p)}</Link>)}
              </span>
            </InfoRow>
          )}
        </dl>
        )}
      </SectionCard>

      {/* Measurements */}
      <SectionCard title="Measurements">
        {e.measurements.length === 0
          ? <p className="text-sm text-slate2/70 italic">No measurements recorded.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate2/70">Variable</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate2/70">Value</th>
                    <th className="pb-2 pr-4 text-xs font-semibold uppercase tracking-wider text-slate2/70">Unit</th>
                    <th className="pb-2 text-xs font-semibold uppercase tracking-wider text-slate2/70">Trial</th>
                  </tr>
                </thead>
                <tbody>
                  {e.measurements.map((r) => (
                    <tr key={r.id} className="border-b border-rule/40 transition-colors duration-100 hover:bg-bench/40">
                      <td className="py-2 pr-4 font-medium">{r.variable_name}</td>
                      <td className="pr-4">{r.value_num ?? r.value_text}</td>
                      <td className="pr-4 text-slate2">{r.unit}</td>
                      <td className="text-slate2">{r.trial_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        {mine && (
          <form onSubmit={addMeasurement} className="mt-4 grid gap-2.5 sm:grid-cols-5 border-t border-rule pt-4">
            <input className="input sm:col-span-2" required placeholder="Variable" value={m.variable_name} onChange={(x) => setM({ ...m, variable_name: x.target.value })} aria-label="Variable" />
            <input className="input" required placeholder="Value" value={m.value} onChange={(x) => setM({ ...m, value: x.target.value })} aria-label="Value" />
            <input className="input" placeholder="Unit" value={m.unit} onChange={(x) => setM({ ...m, unit: x.target.value })} aria-label="Unit" />
            <button className="btn">Add</button>
          </form>
        )}
      </SectionCard>

      <ErrorNote message={error} />

      {/* Record result (owner only) */}
      {mine && (
        <SectionCard title="Record the result">
          <form onSubmit={saveResult} className="space-y-4">
            <Field label="Outcome">
              <select className="input" value={result.outcome} onChange={(x) => setResult({ ...result, outcome: x.target.value })}>
                {OUTCOMES.map((o) => <option key={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Results">
              <textarea className="input" rows={3} value={result.results_summary} onChange={(x) => setResult({ ...result, results_summary: x.target.value })} />
            </Field>
            <Field label="Limitations and deviations from the plan">
              <textarea className="input" rows={3} value={result.limitations} onChange={(x) => setResult({ ...result, limitations: x.target.value })} />
            </Field>
            <NoticeBar message={notice} />
            <div className="flex flex-wrap gap-3">
              <button className="btn">Save result</button>
              {e.review_status === "Draft" && (
                <button type="button" className="btn-quiet" onClick={submitReview}>Submit for review</button>
              )}
              <Link className="btn-quiet" to={`/experiments/new?parent=${e.id}`}>Record a follow-up</Link>
            </div>
          </form>
        </SectionCard>
      )}

      {!mine && (
        <Link className="btn-quiet" to={`/experiments/new?parent=${e.id}`}>Record a follow-up</Link>
      )}

      {/* Evidence files */}
      <SectionCard title="Evidence files">
        <EvidencePanel experimentId={id} mine={mine} />
      </SectionCard>

      {/* Version history */}
      <SectionCard
        title="Version history"
        action={
          <button
            onClick={() => setShowHistory((x) => !x)}
            className="text-xs font-semibold text-ibm hover:underline"
          >
            {showHistory ? "Hide" : "Show"}
          </button>
        }
      >
        {showHistory
          ? <HistoryPanel experimentId={id} />
          : <p className="text-sm text-slate2/70 italic">Click "Show" to load all version snapshots with changed fields highlighted.</p>
        }
      </SectionCard>
    </div>
  );
}

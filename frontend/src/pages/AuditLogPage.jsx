import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, session } from "../services/api.js";
import { ErrorNote } from "../components/ui.jsx";

const ACTION_COLOUR = {
  create:          "bg-emerald-50 text-emerald-700 border-emerald-200",
  update:          "bg-blue-50 text-blue-700 border-blue-200",
  archive:         "bg-slate-100 text-slate-600 border-slate-200",
  submit_review:   "bg-amber-50 text-amber-700 border-amber-200",
  review:          "bg-violet-50 text-violet-700 border-violet-200",
  analyze:         "bg-sky-50 text-sky-700 border-sky-200",
  design_experiment: "bg-rose-50 text-rose-700 border-rose-200",
};

function ActionBadge({ action }) {
  const cls = ACTION_COLOUR[action] || "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {action.replace(/_/g, " ")}
    </span>
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

export default function AuditLogPage() {
  const user = session.user;
  const canView = user?.role === "Reviewer" || user?.role === "Administrator";

  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState("");
  const [filter, setFilter]     = useState({ resource_type: "", resource_id: "" });
  const [page, setPage]         = useState(0);
  const PAGE_SIZE = 50;

  const load = async (p = 0) => {
    if (!canView) return;
    setLoading(true); setErr("");
    try {
      const params = { limit: PAGE_SIZE, offset: p * PAGE_SIZE };
      if (filter.resource_type) params.resource_type = filter.resource_type;
      if (filter.resource_id)   params.resource_id   = filter.resource_id;
      const data = await api.auditLog(params);
      setEntries(data);
      setPage(p);
    } catch (e) { setErr(e.message); }
    finally     { setLoading(false); }
  };

  useEffect(() => { load(0); }, []); // eslint-disable-line

  if (!canView) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <p className="text-sm font-semibold text-ink">Access restricted</p>
        <p className="mt-2 text-sm text-slate2">The audit log is visible to Reviewers and Administrators only.</p>
        <Link to="/" className="mt-4 inline-block text-xs text-ibm underline">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Audit log</h2>
        <p className="mt-1 text-sm text-slate2">
          Immutable record of every create, update, archive, review and analysis action.
          Passwords, tokens and API keys are never logged.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-rule bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate2">Type</label>
          <select
            className="input !w-40 text-xs"
            value={filter.resource_type}
            onChange={(e) => setFilter({ ...filter, resource_type: e.target.value })}
          >
            <option value="">All</option>
            <option value="experiment">Experiment</option>
            <option value="hypothesis">Hypothesis</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate2">Resource ID</label>
          <input
            className="input !w-24 text-xs"
            type="number"
            min="1"
            placeholder="Any"
            value={filter.resource_id}
            onChange={(e) => setFilter({ ...filter, resource_id: e.target.value })}
          />
        </div>
        <button
          onClick={() => load(0)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-ibm px-3 py-1.5 text-xs font-bold text-white hover:bg-ibmdark disabled:opacity-50 transition"
        >
          {loading ? <Spinner /> : null}
          Filter
        </button>
      </div>

      <ErrorNote message={err} />

      {/* Table */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-slate2"><Spinner /> Loading…</div>
      ) : entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-rule bg-white p-10 text-center text-sm italic text-slate2">
          No audit entries found.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-rule shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-rule bg-bench text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70">When</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70">User</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70">Action</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70">Resource</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate2/70">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b border-rule/40 bg-white hover:bg-bench/40 transition-colors">
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate2">
                      {new Date(e.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink">
                      {e.user_id ? `User #${e.user_id}` : <span className="italic text-slate2">system</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <ActionBadge action={e.action} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-ink">
                      <span className="font-medium capitalize">{e.resource_type}</span>
                      {e.resource_id && (
                        <span className="ml-1 text-slate2">
                          #{e.resource_id}
                          {e.resource_type === "experiment" && (
                            <Link
                              to={`/experiments/${e.resource_id}`}
                              className="ml-1 text-ibm hover:underline"
                            >
                              ↗
                            </Link>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate2 max-w-xs truncate">
                      {Object.keys(e.extra || {}).length > 0
                        ? Object.entries(e.extra).map(([k, v]) => (
                            <span key={k} className="mr-2">
                              <span className="font-medium text-ink">{k}:</span>{" "}
                              {typeof v === "object" ? JSON.stringify(v) : String(v)}
                            </span>
                          ))
                        : <span className="italic">—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => load(page - 1)}
              disabled={page === 0 || loading}
              className="rounded-lg border border-rule px-3 py-1.5 text-xs font-semibold text-slate2 hover:bg-bench disabled:opacity-40 transition"
            >
              ← Previous
            </button>
            <span className="text-xs text-slate2">Page {page + 1}</span>
            <button
              onClick={() => load(page + 1)}
              disabled={entries.length < PAGE_SIZE || loading}
              className="rounded-lg border border-rule px-3 py-1.5 text-xs font-semibold text-slate2 hover:bg-bench disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

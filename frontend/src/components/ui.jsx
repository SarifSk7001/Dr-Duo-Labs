const OUTCOME = {
  supported: {
    cls: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dot: "bg-emerald-500",
  },
  contradicted: {
    cls: "bg-red-50 text-red-800 border-red-300",
    dot: "bg-red-500",
  },
  inconclusive: {
    cls: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-400",
  },
  "partially supported": {
    cls: "bg-sky-50 text-sky-800 border-sky-300",
    dot: "bg-sky-500",
  },
  "not completed": {
    cls: "bg-slate-100 text-slate-600 border-slate-300",
    dot: "bg-slate-400",
  },
};

export function OutcomeBadge({ outcome }) {
  const config = OUTCOME[outcome] || OUTCOME["not completed"];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-all duration-200 hover:shadow-sm ${config.cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {outcome}
    </span>
  );
}

export function Tag({ children }) {
  return (
    <span className="inline-flex items-center rounded-md bg-bench px-2 py-0.5 text-xs font-medium text-slate2 ring-1 ring-inset ring-rule transition-colors duration-150 hover:bg-rule">
      {children}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-sm font-semibold tracking-tight text-ink transition-colors duration-150 group-focus-within:text-ibm">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 flex items-start gap-1 text-xs text-slate2">
          <svg
            className="mt-px h-3 w-3 shrink-0 text-slate2/70"
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 3.5a.875.875 0 1 0 0 1.75A.875.875 0 0 0 8 4.5ZM7.25 7v4.5h1.5V7h-1.5Z" />
          </svg>
          {hint}
        </span>
      )}
    </label>
  );
}

export function ErrorNote({ message }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800 animate-in"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
        viewBox="0 0 16 16"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1ZM7.25 4.5v4h1.5v-4h-1.5Zm0 5.75v1.5h1.5v-1.5h-1.5Z" />
      </svg>
      {message}
    </p>
  );
}

export function DocBadge({ score, total }) {
  const pct = total > 0 ? score / total : 0;
  const colour =
    pct >= 0.875 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    pct >= 0.5   ? "bg-amber-50 text-amber-700 border-amber-200" :
                   "bg-slate-50 text-slate-500 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colour}`}>
      <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5" aria-hidden="true">
        <path d="M6 1a5 5 0 1 1 0 10A5 5 0 0 1 6 1Zm-.75 2.5v3l2.5 1.5.5-.87-2-.12V3.5h-1Z" />
      </svg>
      {score}/{total} documented
    </span>
  );
}

export function List({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold tracking-tight text-ink">{title}</h4>
      <ul className="space-y-1.5 text-sm text-slate2">
        {items.map((x, i) => (
          <li
            key={i}
            className="flex items-start gap-2"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ibm/60" aria-hidden="true" />
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

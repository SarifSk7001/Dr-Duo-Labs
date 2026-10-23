import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, session } from "../services/api.js";

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const OUTCOME_KEYS = ["supported", "contradicted", "inconclusive", "partially supported", "not completed"];

const OUTCOME_COLOURS = {
  supported: "#10b981",
  contradicted: "#ef4444",
  inconclusive: "#f59e0b",
  "partially supported": "#38bdf8",
  "not completed": "#94a3b8",
};

const OUTCOME_PILL = {
  supported: "bg-emerald-50 text-emerald-700 border-emerald-200",
  contradicted: "bg-red-50 text-red-700 border-red-200",
  inconclusive: "bg-amber-50 text-amber-700 border-amber-200",
  "partially supported": "bg-sky-50 text-sky-700 border-sky-200",
  "not completed": "bg-slate-100 text-slate-600 border-slate-200",
};

const HERO_WORDS = ["Record", "Search", "Challenge", "Compare", "Learn"];

const I = {
  search: "M21 21l-4.35-4.35M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  plus: "M12 5v14M5 12h14",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  columns: "M4 5h6v14H4zM14 5h6v14h-6z",
  sparkle: "M9.8 15.9 9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.1L2.25 12l2.85-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.1l2.85.8-2.85.8a4.5 4.5 0 0 0-3.1 3.1ZM18 3l.5 1.5L20 5l-1.5.5L18 7l-.5-1.5L16 5l1.5-.5L18 3Z",
  graph: "M6 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 22a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM7.8 5.2l8.4 3.6M7.8 18.8l8.4-3.6",
  flask: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3",
  check: "M5 13l4 4L19 7",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  x: "M6 6l12 12M18 6 6 18",
  dots: "M5 12h.01M12 12h.01M19 12h.01",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  doc: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

const TOOLS = [
  { to: "/repository", title: "Experiment Repository", body: "Semantic and keyword search across every record, failures included.", icon: I.search, tone: "from-blue-500 to-blue-600", ring: "group-hover:shadow-blue-500/20" },
  { to: "/experiments/new", title: "Record Experiment", body: "Capture hypothesis, method, conditions and outcome in a structured form.", icon: I.plus, tone: "from-emerald-500 to-emerald-600", ring: "group-hover:shadow-emerald-500/20" },
  { to: "/hypotheses", title: "Hypothesis Lab", body: "Challenge assumptions against your own evidence and plan the next test.", icon: I.bulb, tone: "from-violet-500 to-violet-600", ring: "group-hover:shadow-violet-500/20" },
  { to: "/ai-check", title: "AI check", body: "Cross-check ideas against published literature from OpenAlex and arXiv.", icon: I.sparkle, tone: "from-fuchsia-500 to-pink-600", ring: "group-hover:shadow-pink-500/20", badge: "New" },
  { to: "/compare", title: "Compare Experiments", body: "Line up conditions, sample size and outcomes side by side.", icon: I.columns, tone: "from-rose-500 to-rose-600", ring: "group-hover:shadow-rose-500/20" },
  { to: "/graph", title: "Knowledge Graph", body: "Explore follow-ups and hypothesis links as an interactive network.", icon: I.graph, tone: "from-cyan-500 to-sky-600", ring: "group-hover:shadow-sky-500/20" },
];

const STEPS = [
  { n: "01", title: "Record", body: "Log every experiment, including null results and failures." },
  { n: "02", title: "Search", body: "Check what already exists before you start something new." },
  { n: "03", title: "Challenge", body: "Test hypotheses against real, access-checked evidence." },
  { n: "04", title: "Build knowledge", body: "Grow a queryable evidence base your whole team trusts." },
];

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useInView(threshold = 0.2) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!("IntersectionObserver" in window)) { setInView(true); return undefined; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function useCountUp(target, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (typeof target !== "number" || Number.isNaN(target)) return undefined;
    if (reducedMotion()) { setVal(target); return undefined; }
    let raf; let start;
    const tick = (t) => {
      if (start === undefined) start = t;
      const p = Math.min(1, (t - start) / duration);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

function CountUp({ value, decimals = 0, suffix = "" }) {
  const v = useCountUp(value);
  if (typeof value !== "number") return <span className="dx-skel inline-block h-7 w-12 rounded-md align-middle" />;
  return <>{v.toFixed(decimals)}{suffix}</>;
}

function Reveal({ children, delay = 0, className = "" }) {
  const [ref, shown] = useInView(0.1);
  return (
    <div ref={ref} className={`dx-reveal ${shown ? "dx-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Icon({ d, className = "h-5 w-5", stroke = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Card({ title, subtitle, action, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-[#e4e7ec] bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div className="flex h-[170px] items-center justify-center px-4 text-center text-xs italic text-slate-400">{children}</div>;
}

/* ─────────────────────────────────────────────────────────────
   Charts (pure SVG / CSS, animated when scrolled into view)
───────────────────────────────────────────────────────────── */
function Ring({ pct, size = 132, stroke = 11, colour = "#34d399", track = "rgba(255,255,255,.12)" }) {
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 350); return () => clearTimeout(t); }, []);
  const p = typeof pct === "number" ? Math.min(100, Math.max(0, pct)) : 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={C} strokeDashoffset={on ? C * (1 - p / 100) : C}
        style={{ transition: "stroke-dashoffset 1.6s cubic-bezier(.16,1,.3,1)", filter: "drop-shadow(0 0 6px rgba(52,211,153,.55))" }}
      />
    </svg>
  );
}

function DonutChart({ data }) {
  const [ref, inView] = useInView(0.3);
  const [hover, setHover] = useState(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Empty>No experiments yet. Record the first one to see the breakdown.</Empty>;

  const R = 62; const C = 2 * Math.PI * R; const SW = 22;
  let acc = 0;
  const segs = data.map((d) => {
    const len = (d.value / total) * C;
    const seg = { ...d, len, off: acc };
    acc += len;
    return seg;
  });
  const active = hover ? segs.find((s) => s.label === hover) : null;

  return (
    <div ref={ref} className="flex flex-wrap items-center justify-center gap-6 sm:justify-start">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <svg viewBox="0 0 168 168" className="-rotate-90">
          <circle cx="84" cy="84" r={R} fill="none" stroke="#f1f3f6" strokeWidth={SW} />
          {segs.map((s, i) => (
            <circle
              key={s.label} cx="84" cy="84" r={R} fill="none" stroke={s.colour}
              strokeWidth={hover === s.label ? SW + 5 : SW}
              strokeDasharray={`${inView ? Math.max(0, s.len - 2) : 0} ${C}`}
              strokeDashoffset={-s.off}
              onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}
              style={{ transition: `stroke-dasharray 1.1s cubic-bezier(.16,1,.3,1) ${i * 110}ms, stroke-width .2s`, cursor: "pointer" }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold tracking-tight text-ink">{active ? active.value : total}</span>
          <span className="max-w-[90px] text-center text-[10px] font-medium capitalize leading-tight text-slate-400">
            {active ? active.label : "experiments"}
          </span>
        </div>
      </div>
      <ul className="min-w-[150px] flex-1 space-y-1.5 text-xs">
        {segs.map((s) => (
          <li
            key={s.label}
            onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center gap-2 rounded-md px-2 py-1 transition-colors ${hover === s.label ? "bg-[#f4f5f7]" : ""}`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.colour }} />
            <span className="capitalize text-slate-600">{s.label}</span>
            <span className="ml-auto font-bold text-ink">{s.value}</span>
            <span className="w-9 text-right text-slate-400">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActivityChart({ months }) {
  const [ref, inView] = useInView(0.3);
  const max = Math.max(...months.map((m) => m.count), 1);
  if (months.every((m) => m.count === 0)) return <Empty>No activity in the last six months.</Empty>;
  return (
    <div ref={ref} className="flex h-[170px] items-end gap-3 pt-4">
      {months.map((m, i) => {
        const h = (m.count / max) * 100;
        return (
          <div key={m.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-2" title={`${m.count} experiment${m.count === 1 ? "" : "s"}`}>
            <span className="text-[11px] font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100">{m.count}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-lg bg-gradient-to-t from-ibm to-sky-400 shadow-sm group-hover:brightness-110"
                style={{
                  height: inView ? `${Math.max(h, m.count ? 6 : 2)}%` : "0%",
                  opacity: m.count ? 1 : 0.25,
                  transition: `height 1s cubic-bezier(.16,1,.3,1) ${i * 90}ms, filter .2s`,
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-slate-400">{m.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function DomainChart({ domains }) {
  const [ref, inView] = useInView(0.3);
  if (domains.length === 0) return <Empty>No domains yet.</Empty>;
  const max = Math.max(...domains.map((d) => d.total), 1);
  return (
    <div ref={ref} className="space-y-3.5">
      {domains.map((d, i) => (
        <div key={d.name}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="truncate font-medium capitalize text-ink">{d.name}</span>
            <span className="ml-2 shrink-0 font-bold text-slate-500">{d.total}</span>
          </div>
          <div className="flex h-2.5 overflow-hidden rounded-full bg-[#f1f3f6]">
            {OUTCOME_KEYS.filter((k) => d.counts[k]).map((k) => (
              <div
                key={k}
                title={`${k}: ${d.counts[k]}`}
                style={{
                  width: inView ? `${(d.counts[k] / max) * 100}%` : "0%",
                  background: OUTCOME_COLOURS[k],
                  transition: `width 1s cubic-bezier(.16,1,.3,1) ${i * 90}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const SRC_LABEL = { openalex: "OpenAlex", arxiv: "arXiv" };

function TrendingList({ items, error, onRetry }) {
  if (error) {
    return (
      <div className="px-5 py-10 text-center text-xs text-slate-500">
        <p className="mb-3 text-red-600">{error}</p>
        <button onClick={onRetry} className="rounded-lg border border-[#d0d5dd] px-3 py-1.5 font-semibold text-ink transition hover:bg-[#f4f5f7]">Try again</button>
      </div>
    );
  }
  if (items === null) return <Skeleton rows={5} />;
  if (items.length === 0) return <div className="px-5 py-10 text-center text-xs text-slate-400">No trending research found right now.</div>;
  return items.map((r, i) => (
    <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer"
      className="dx-rise group flex items-start gap-3.5 border-b border-[#f0f0f0] px-5 py-4 transition-colors last:border-0 hover:bg-[#f7f8fa]"
      style={{ animationDelay: `${i * 90}ms` }}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm transition-transform duration-300 group-hover:scale-110 ${
        i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" : i === 1 ? "bg-gradient-to-br from-slate-400 to-slate-500" : i === 2 ? "bg-gradient-to-br from-orange-300 to-amber-700" : "bg-gradient-to-br from-ibm to-sky-500"
      }`}>{i + 1}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold leading-snug text-ink transition-colors group-hover:text-ibm">{r.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
          <span className="rounded-full bg-[#f1f3f6] px-2 py-0.5 font-semibold text-slate-500">{SRC_LABEL[r.source] || r.source}</span>
          {r.year && <span>{r.year}</span>}
          {r.authors?.length > 0 && <span className="truncate">{r.authors.slice(0, 2).join(", ")}{r.authors.length > 2 ? " et al." : ""}</span>}
        </p>
        {r.abstract && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{r.abstract}</p>}
      </div>
      <Icon d="M7 17 17 7M8 7h9v9" className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ibm" stroke={2} />
    </a>
  ));
}

function Skeleton({ rows = 3 }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="dx-skel h-9 rounded-lg" />)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const name = session.user?.name?.split(" ")[0] || "there";

  const [trending, setTrending] = useState(null);
  const [trendErr, setTrendErr] = useState("");
  const [hypotheses, setHypotheses] = useState(null);
  const [data, setData] = useState(null);
  const [wordIdx, setWordIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setWordIdx((i) => (i + 1) % HERO_WORDS.length), 2400);
    return () => clearInterval(t);
  }, []);

  const loadTrending = () => {
    setTrendErr(""); setTrending(null);
    api.trendingExternal(5).then(setTrending).catch((e) => setTrendErr(e.message));
  };
  useEffect(() => { loadTrending(); }, []); // eslint-disable-line

  useEffect(() => {
    api.get("/hypotheses").then(setHypotheses).catch(() => setHypotheses([]));

    api.get("/experiments?limit=100").then((exps) => {
      const counts = Object.fromEntries(OUTCOME_KEYS.map((o) => [o, 0]));
      exps.forEach((e) => { counts[e.outcome] = (counts[e.outcome] || 0) + 1; });

      const domainMap = {};
      exps.forEach((e) => {
        const d = domainMap[e.domain] || (domainMap[e.domain] = { name: e.domain, total: 0, counts: {} });
        d.total += 1;
        d.counts[e.outcome] = (d.counts[e.outcome] || 0) + 1;
      });
      const domains = Object.values(domainMap).sort((a, b) => b.total - a.total).slice(0, 5);

      const months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
        return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString(undefined, { month: "short" }), count: 0 };
      });
      exps.forEach((e) => {
        const d = new Date(e.created_at);
        const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
        if (m) m.count += 1;
      });

      const avgDoc = exps.length
        ? (exps.reduce((s, e) => s + (e.doc_total ? e.doc_score / e.doc_total : 0), 0) / exps.length) * 100
        : 0;

      setData({
        total: exps.length,
        counts,
        domainCount: new Set(exps.map((e) => e.domain)).size,
        domains, months, avgDoc,
        pie: OUTCOME_KEYS.map((o) => ({ label: o, value: counts[o], colour: OUTCOME_COLOURS[o] })).filter((d) => d.value > 0),
      });
    }).catch(() => setData({ total: 0, counts: Object.fromEntries(OUTCOME_KEYS.map((o) => [o, 0])), domainCount: 0, domains: [], months: [], avgDoc: 0, pie: [] }));
  }, []);

  const total = data?.total;
  const supportedPct = data && data.total ? (data.counts.supported / data.total) * 100 : 0;

  const kpis = [
    { label: "Experiments", value: data?.total, icon: I.flask, tone: "text-ibm bg-blue-50", bar: "bg-ibm", frac: 1 },
    { label: "Supported", value: data?.counts.supported, icon: I.check, tone: "text-emerald-600 bg-emerald-50", bar: "bg-emerald-500", frac: total ? data.counts.supported / total : 0 },
    { label: "Contradicted", value: data?.counts.contradicted, icon: I.x, tone: "text-red-500 bg-red-50", bar: "bg-red-500", frac: total ? data.counts.contradicted / total : 0 },
    { label: "Inconclusive", value: data?.counts.inconclusive, icon: I.dots, tone: "text-amber-500 bg-amber-50", bar: "bg-amber-400", frac: total ? data.counts.inconclusive / total : 0 },
    { label: "Research domains", value: data?.domainCount, icon: I.globe, tone: "text-violet-600 bg-violet-50", bar: "bg-violet-500", frac: Math.min(1, (data?.domainCount || 0) / 10) },
    { label: "Avg. documentation", value: data ? Math.round(data.avgDoc) : undefined, suffix: "%", icon: I.doc, tone: "text-sky-600 bg-sky-50", bar: "bg-sky-500", frac: data ? data.avgDoc / 100 : 0 },
  ];

  return (
    <div className="dx-root min-h-[calc(100vh-60px)] bg-[#f4f5f7]">
      <style>{`
        @keyframes dx-float-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(60px,40px,0) scale(1.18)}}
        @keyframes dx-float-b{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-70px,30px,0) scale(1.12)}}
        @keyframes dx-float-c{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(30px,-40px,0)}}
        @keyframes dx-gradient{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes dx-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes dx-word{0%{opacity:0;transform:translateY(12px)}12%,88%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-12px)}}
        @keyframes dx-ping{0%{transform:scale(.8);opacity:.7}100%{transform:scale(2.4);opacity:0}}
        @keyframes dx-rise{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:none}}
        @keyframes dx-grid{to{background-position:36px 36px}}
        @keyframes dx-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        .dx-rise{animation:dx-rise .8s cubic-bezier(.16,1,.3,1) both}
        .dx-reveal{opacity:0;transform:translateY(26px);transition:opacity .8s cubic-bezier(.16,1,.3,1),transform .8s cubic-bezier(.16,1,.3,1)}
        .dx-reveal.dx-in{opacity:1;transform:none}
        .dx-gradient-text{background:linear-gradient(90deg,#fff 0%,#a5c8ff 25%,#d8c8ff 50%,#a5c8ff 75%,#fff 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:dx-gradient 7s linear infinite}
        .dx-skel{background:linear-gradient(90deg,#eceff3 25%,#f8f9fb 50%,#eceff3 75%);background-size:200% 100%;animation:dx-shimmer 1.4s linear infinite}
        .dx-grid{background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);background-size:36px 36px;animation:dx-grid 8s linear infinite;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
        .dx-word{display:inline-block;animation:dx-word 2.4s ease-in-out infinite}
        .dx-shine{position:relative;overflow:hidden}
        .dx-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);transition:transform .8s}
        .dx-shine:hover::after{transform:translateX(120%)}
        @media (prefers-reduced-motion:reduce){.dx-root *{animation:none!important;transition:none!important}}
      `}</style>

      {/* ══ HERO ════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0a2647] via-[#0f3460] to-[#1a3f7a] px-6 pb-32 pt-14 sm:pt-20">
        <div className="dx-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -left-24 top-[-6rem] h-96 w-96 rounded-full bg-ibm/40 blur-3xl" style={{ animation: "dx-float-a 14s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute right-[-6rem] top-10 h-96 w-96 rounded-full bg-violet-500/25 blur-3xl" style={{ animation: "dx-float-b 18s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute bottom-[-8rem] left-1/3 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" style={{ animation: "dx-float-c 16s ease-in-out infinite" }} />

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <span className="dx-rise inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-white/80 backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" style={{ animation: "dx-ping 1.8s ease-out infinite" }} />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {greeting()}, {name}
            </span>

            <h1 className="dx-rise mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-6xl" style={{ animationDelay: "100ms" }}>
              <span className="dx-gradient-text">Experiment Exchange</span>
            </h1>

            <p className="dx-rise mt-5 flex flex-wrap items-baseline gap-x-2 text-xl font-semibold text-white/90 sm:text-2xl" style={{ animationDelay: "200ms" }}>
              <span key={wordIdx} className="dx-word rounded-lg bg-white/10 px-3 py-0.5 text-sky-200 backdrop-blur-sm">{HERO_WORDS[wordIdx]}</span>
              <span className="text-white/60">every result, even the ones that failed.</span>
            </p>

            <p className="dx-rise mt-4 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base" style={{ animationDelay: "300ms" }}>
              One shared, searchable evidence base for your organisation. Stop repeating work and start building
              knowledge, with AI that cites only what is actually in your records.
            </p>

            <div className="dx-rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: "400ms" }}>
              <button onClick={() => navigate("/repository")}
                className="dx-shine flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#0f3460] shadow-lg shadow-black/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                <Icon d={I.search} className="h-4 w-4" stroke={2.2} /> Browse experiments
              </button>
              <button onClick={() => navigate("/experiments/new")}
                className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/20">
                <Icon d={I.plus} className="h-4 w-4" stroke={2.2} /> Record an experiment
              </button>
              <button onClick={() => navigate("/ai-check")}
                className="dx-shine flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-900/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl">
                <Icon d={I.sparkle} className="h-4 w-4" stroke={2.2} /> AI check
              </button>
            </div>
          </div>

          {/* Glass health card */}
          <div className="dx-rise hidden lg:block" style={{ animationDelay: "350ms" }}>
            <div style={{ animation: "dx-bob 6s ease-in-out infinite" }}>
              <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-[.14em] text-white/60">Repository health</p>
                  <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">Live</span>
                </div>
                <div className="mt-5 flex items-center gap-6">
                  <div className="relative shrink-0">
                    <Ring pct={supportedPct} />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-extrabold text-white"><CountUp value={data ? Math.round(supportedPct) : undefined} suffix="%" /></span>
                      <span className="text-[10px] font-medium text-white/60">supported</span>
                    </div>
                  </div>
                  <dl className="flex-1 space-y-3 text-sm">
                    {[
                      ["Experiments", data?.total],
                      ["Hypotheses", hypotheses ? hypotheses.length : undefined],
                      ["Domains", data?.domainCount],
                    ].map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between border-b border-white/10 pb-2 last:border-0 last:pb-0">
                        <dt className="text-white/60">{k}</dt>
                        <dd className="text-lg font-bold text-white"><CountUp value={v} /></dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <svg className="pointer-events-none absolute bottom-0 left-0 w-full text-[#f4f5f7]" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
          <path fill="currentColor" d="M0 60V30C240 0 480 0 720 22s480 22 720-8v46Z" />
        </svg>
      </section>

      {/* ══ KPI STRIP ═══════════════════════════════════════════ */}
      <section className="relative z-10 -mt-20 px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {kpis.map((k, i) => (
            <div key={k.label}
              className="dx-rise group rounded-2xl border border-[#e4e7ec] bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
              style={{ animationDelay: `${500 + i * 80}ms` }}>
              <div className="flex items-center justify-between">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${k.tone}`}>
                  <Icon d={k.icon} className="h-[18px] w-[18px]" />
                </span>
              </div>
              <p className="mt-3 text-3xl font-extrabold tracking-tight text-ink"><CountUp value={k.value} suffix={k.suffix || ""} /></p>
              <p className="mt-0.5 text-[11px] font-medium text-slate-400">{k.label}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#f1f3f6]">
                <div className={`h-full rounded-full ${k.bar}`} style={{ width: `${Math.round((data ? k.frac : 0) * 100)}%`, transition: "width 1.4s cubic-bezier(.16,1,.3,1) .6s" }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ TOOLS ═══════════════════════════════════════════════ */}
      <section className="px-6 pb-4 pt-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label mb-2">Workspace</p>
            <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-ink">Everything you need, one click away</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.to} delay={i * 70}>
                <button onClick={() => navigate(t.to)}
                  className={`group relative flex h-full w-full items-start gap-4 overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white p-5 text-left shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-transparent hover:shadow-2xl ${t.ring}`}>
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${t.tone} text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6`}>
                    <Icon d={t.icon} className="h-6 w-6" stroke={1.7} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-[15px] font-bold tracking-tight text-ink">{t.title}</span>
                      {t.badge && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-pink-600">{t.badge}</span>}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">{t.body}</span>
                  </span>
                  <Icon d={I.arrow} className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-ibm" stroke={2} />
                  <span className={`pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r ${t.tone} transition-transform duration-500 group-hover:scale-x-100`} />
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ ANALYTICS ═══════════════════════════════════════════ */}
      <section className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label mb-2">Analytics</p>
            <h2 className="mb-6 text-2xl font-extrabold tracking-tight text-ink">Repository at a glance</h2>
          </Reveal>
          <div className="grid gap-4 lg:grid-cols-2">
            <Reveal><Card title="Outcome breakdown" subtitle="Hover a segment to inspect it">
              {data ? <DonutChart data={data.pie} /> : <Skeleton rows={3} />}
            </Card></Reveal>
            <Reveal delay={80}><Card title="Recording activity" subtitle="Experiments created per month, last 6 months">
              {data ? <ActivityChart months={data.months} /> : <Skeleton rows={3} />}
            </Card></Reveal>
            <Reveal delay={0} className="lg:col-span-2"><Card title="Outcomes by domain" subtitle="Top 5 domains, coloured by outcome">
              {data ? <DomainChart domains={data.domains} /> : <Skeleton rows={4} />}
            </Card></Reveal>
          </div>
        </div>
      </section>

      {/* ══ RECENT ══════════════════════════════════════════════ */}
      <section className="px-6 pb-12">
        <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
              <div className="flex items-start justify-between gap-3 border-b border-[#f0f0f0] px-5 py-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-ink">
                    Top 5 research happening worldwide
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400" style={{ animation: "dx-ping 1.8s ease-out infinite" }} />
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {trending && trending.length > 0 && trending.every((r) => r.source === "arxiv")
                      ? "Newest AI preprints from arXiv"
                      : "Most-cited papers from the last 90 days · OpenAlex"}
                  </p>
                </div>
                <button onClick={() => navigate("/ai-check")} className="shrink-0 text-xs font-bold text-ibm hover:underline">Search more</button>
              </div>
              <TrendingList items={trending} error={trendErr} onRetry={loadTrending} />
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl border border-[#e4e7ec] bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-[#f0f0f0] px-5 py-4">
                <h3 className="text-sm font-bold tracking-tight text-ink">Recent hypotheses</h3>
                <button onClick={() => navigate("/hypotheses")} className="text-xs font-bold text-violet-600 hover:underline">Open lab</button>
              </div>
              {hypotheses === null ? <Skeleton rows={4} /> : hypotheses.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-slate-400">
                  No hypotheses yet.{" "}
                  <button onClick={() => navigate("/hypotheses")} className="font-semibold text-violet-600 underline">Challenge your first assumption</button>.
                </div>
              ) : hypotheses.slice(0, 5).map((h, i) => (
                <button key={h.id} onClick={() => navigate("/hypotheses")}
                  className="dx-rise group flex w-full items-center gap-3 border-b border-[#f0f0f0] px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-[#f7f8fa]"
                  style={{ animationDelay: `${i * 70}ms` }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon d={I.bulb} className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink transition-colors group-hover:text-violet-600">{h.title}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{h.status} · {timeAgo(h.created_at)}</p>
                  </div>
                  <Icon d={I.arrow} className="h-3.5 w-3.5 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-violet-600" stroke={2} />
                </button>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ══ WORKFLOW ════════════════════════════════════════════ */}
      <section className="border-y border-[#e4e7ec] bg-white px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="section-label mb-2">The loop</p>
            <h2 className="mb-10 text-2xl font-extrabold tracking-tight text-ink">From individual tests to organisational knowledge</h2>
          </Reveal>
          <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-ibm/30 to-transparent lg:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 110}>
                <div className="group relative">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-[#e4e7ec] bg-white text-sm font-black text-ibm shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:bg-ibm group-hover:text-white group-hover:shadow-lg">
                    {s.n}
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-ink">{s.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ NEGATIVE RESULTS ════════════════════════════════════ */}
      <section className="px-6 py-10">
        <Reveal>
          <div className="mx-auto flex max-w-4xl items-start gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><Icon d={I.alert} /></span>
            <div>
              <p className="text-sm font-bold text-amber-900">Include negative results</p>
              <p className="mt-1 text-xs leading-relaxed text-amber-800">
                Contradicted, inconclusive and partially supported experiments are equally important records. They prevent
                duplicated effort, expose false assumptions and keep the evidence base honest.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[#e4e7ec] bg-white px-6 py-5">
        <p className="text-center text-xs text-slate-400">© {new Date().getFullYear()} Experiment Exchange + Hypothesia</p>
      </footer>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../services/api.js";
import { ErrorNote } from "../components/ui.jsx";

// ── Colour helpers ────────────────────────────────────────────────────────────
const OUTCOME_FILL = {
  supported:            "#10b981",
  contradicted:         "#ef4444",
  inconclusive:         "#f59e0b",
  "partially supported":"#38bdf8",
  "not completed":      "#94a3b8",
};

function nodeFill(node) {
  if (node.kind === "hypothesis") return "#7c5cd8";
  return OUTCOME_FILL[node.outcome] || "#94a3b8";
}

// ── Force-directed layout (Fruchterman–Reingold, pure JS) ────────────────────
// Runs for a fixed number of iterations then stops — no animation loop needed.

function layoutOnce(nodes, edges, W, H, iterations = 120) {
  const N = nodes.length;
  if (N === 0) return nodes;

  const area = W * H;
  const k = Math.sqrt(area / N) * 0.9;
  const pos = nodes.map((_, i) => ({
    x: W * 0.1 + Math.random() * W * 0.8,
    y: H * 0.1 + Math.random() * H * 0.8,
    dx: 0,
    dy: 0,
  }));

  const idx = Object.fromEntries(nodes.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = k * Math.max(0.1, 1 - iter / iterations);

    // Reset displacement
    for (const p of pos) { p.dx = 0; p.dy = 0; }

    // Repulsion between all pairs
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = (k * k) / dist;
        dx = (dx / dist) * f;
        dy = (dy / dist) * f;
        pos[i].dx += dx; pos[i].dy += dy;
        pos[j].dx -= dx; pos[j].dy -= dy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const si = idx[e.source]; const ti = idx[e.target];
      if (si === undefined || ti === undefined) continue;
      const dx = pos[ti].x - pos[si].x;
      const dy = pos[ti].y - pos[si].y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (dist * dist) / k;
      pos[si].dx += (dx / dist) * f;
      pos[si].dy += (dy / dist) * f;
      pos[ti].dx -= (dx / dist) * f;
      pos[ti].dy -= (dy / dist) * f;
    }

    // Limit displacement and apply
    for (const p of pos) {
      const disp = Math.sqrt(p.dx * p.dx + p.dy * p.dy);
      if (disp > 0) {
        const s = Math.min(disp, temp) / disp;
        p.x = Math.max(24, Math.min(W - 24, p.x + p.dx * s));
        p.y = Math.max(24, Math.min(H - 24, p.y + p.dy * s));
      }
    }
  }

  return nodes.map((n, i) => ({ ...n, x: pos[i].x, y: pos[i].y }));
}

// ── Component ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-ibm" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

export default function KnowledgeGraph() {
  const navigate = useNavigate();
  const containerRef = useRef();
  const [rawData, setRawData]   = useState(null);
  const [laid, setLaid]         = useState(null);  // laid-out nodes with x,y
  const [dim, setDim]           = useState({ w: 800, h: 560 });
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [err, setErr]           = useState("");
  // Pan/zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const dragging = useRef(null);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDim({ w: e.contentRect.width, h: Math.max(400, e.contentRect.width * 0.65) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Fetch
  useEffect(() => {
    api.get("/graph")
      .then(setRawData)
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Layout whenever data or dimensions change
  useEffect(() => {
    if (!rawData) return;
    // Seed for reproducibility: reset random with a deterministic starting point
    // by sorting nodes so the layout is stable on re-render.
    const stable = [...rawData.nodes].sort((a, b) => a.id.localeCompare(b.id));
    const withPos = layoutOnce(stable, rawData.edges, dim.w, dim.h);
    setLaid(withPos);
  }, [rawData, dim]);

  // Pan
  const onMouseDown = (e) => {
    if (e.target.closest("[data-node]")) return;
    dragging.current = { startX: e.clientX - transform.x, startY: e.clientY - transform.y };
  };
  const onMouseMove = (e) => {
    if (!dragging.current) return;
    setTransform((t) => ({ ...t, x: e.clientX - dragging.current.startX, y: e.clientY - dragging.current.startY }));
  };
  const onMouseUp = () => { dragging.current = null; };

  // Zoom
  const onWheel = (e) => {
    e.preventDefault();
    setTransform((t) => {
      const scale = Math.max(0.3, Math.min(3, t.scale * (e.deltaY < 0 ? 1.1 : 0.9)));
      return { ...t, scale };
    });
  };

  const nodeMap = laid ? Object.fromEntries(laid.map((n) => [n.id, n])) : {};

  const selNode = selected ? nodeMap[selected] : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 md:px-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate2 hover:text-ibm transition-colors">
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M14 8a.75.75 0 0 1-.75.75H4.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L4.56 7.25h8.69A.75.75 0 0 1 14 8Z" clipRule="evenodd" /></svg>
        Back to dashboard
      </Link>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Knowledge graph</h2>
          <p className="mt-1 text-sm text-slate2">
            Experiments and hypotheses as nodes. Arrows show follow-up relationships and hypothesis links.
            Drag to pan · scroll to zoom · click a node to inspect.
          </p>
        </div>
        <button
          onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}
          className="shrink-0 rounded-lg border border-rule px-3 py-1.5 text-xs font-semibold text-slate2 hover:bg-bench transition"
        >
          Reset view
        </button>
      </div>

      <ErrorNote message={err} />

      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate2"><Spinner /> Loading graph…</div>
      )}

      {/* Legend */}
      {laid && (
        <div className="flex flex-wrap gap-3 text-[11px] text-slate2">
          {[
            ["Hypothesis", "#7c5cd8"],
            ["Supported", "#10b981"],
            ["Contradicted", "#ef4444"],
            ["Inconclusive", "#f59e0b"],
            ["Partial", "#38bdf8"],
            ["Not done", "#94a3b8"],
          ].map(([label, colour]) => (
            <span key={label} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: colour }} />
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl border border-rule bg-[#f9fafb] cursor-grab active:cursor-grabbing select-none"
        style={{ height: dim.h }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        {laid && (
          <svg
            width={dim.w}
            height={dim.h}
            viewBox={`0 0 ${dim.w} ${dim.h}`}
            style={{ transform: `translate(${transform.x}px,${transform.y}px) scale(${transform.scale})`, transformOrigin: "0 0" }}
          >
            {/* Arrow marker */}
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#cbd5e1" />
              </marker>
              <marker id="arrow-hyp" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 z" fill="#7c5cd8" />
              </marker>
            </defs>

            {/* Edges */}
            {rawData.edges.map((e, i) => {
              const s = nodeMap[e.source]; const t = nodeMap[e.target];
              if (!s || !t) return null;
              const dx = t.x - s.x; const dy = t.y - s.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const R = 13;
              // Shorten line by node radius
              const x2 = t.x - (dx / len) * (R + 6);
              const y2 = t.y - (dy / len) * (R + 6);
              const isHyp = e.kind === "hypothesis_link";
              return (
                <line
                  key={i}
                  x1={s.x} y1={s.y} x2={x2} y2={y2}
                  stroke={isHyp ? "#c4b5fd" : "#cbd5e1"}
                  strokeWidth={isHyp ? 1.5 : 1.2}
                  strokeDasharray={isHyp ? "4 3" : undefined}
                  markerEnd={isHyp ? "url(#arrow-hyp)" : "url(#arrow)"}
                />
              );
            })}

            {/* Nodes */}
            {laid.map((node) => {
              const isSelected = selected === node.id;
              const r = node.kind === "hypothesis" ? 16 : 13;
              const fill = nodeFill(node);
              return (
                <g
                  key={node.id}
                  data-node="1"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(isSelected ? null : node.id)}
                >
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={fill}
                    stroke={isSelected ? "#1d4ed8" : "white"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    opacity={0.92}
                  />
                  <text
                    x={node.x} y={node.y + r + 11}
                    textAnchor="middle"
                    fontSize="9"
                    fill="#374151"
                    fontWeight={isSelected ? "700" : "400"}
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {laid?.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm italic text-slate2">
            No experiments or hypotheses to show yet.
          </div>
        )}
      </div>

      {/* Inspector */}
      {selNode && (
        <div className="rounded-xl border border-rule bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: nodeFill(selNode) }} />
              <p className="text-sm font-semibold text-ink">{selNode.label}</p>
              <span className="rounded-full bg-bench px-2 py-0.5 text-[10px] text-slate2">{selNode.kind}</span>
            </div>
            <button onClick={() => setSelected(null)} className="text-xs text-slate2 hover:text-ink">✕ Close</button>
          </div>
          {selNode.outcome && (
            <p className="mt-2 text-xs text-slate2">Outcome: <strong className="text-ink capitalize">{selNode.outcome}</strong></p>
          )}
          {selNode.review_status && (
            <p className="mt-0.5 text-xs text-slate2">Status: <strong className="text-ink">{selNode.review_status}</strong></p>
          )}
          {selNode.kind === "experiment" && (
            <button
              onClick={() => navigate(`/experiments/${selNode.id.replace("exp-", "")}`)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-ibm px-3 py-1.5 text-xs font-bold text-white hover:bg-ibmdark transition"
            >
              Open experiment →
            </button>
          )}
          {/* Connected nodes */}
          {rawData && (() => {
            const connected = rawData.edges
              .filter((e) => e.source === selNode.id || e.target === selNode.id)
              .map((e) => {
                const other = e.source === selNode.id ? e.target : e.source;
                const n = nodeMap[other];
                return n ? { node: n, direction: e.source === selNode.id ? "→" : "←", kind: e.kind } : null;
              })
              .filter(Boolean);
            if (connected.length === 0) return null;
            return (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate2/70 mb-1.5">Connected</p>
                <div className="flex flex-wrap gap-1.5">
                  {connected.map(({ node, direction, kind }, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1 rounded-full border border-rule bg-bench px-2.5 py-0.5 text-[11px] text-ink cursor-pointer hover:bg-rule"
                      onClick={() => setSelected(node.id)}
                    >
                      <span style={{ color: nodeFill(node) }}>●</span>
                      {direction} {node.label}
                      <span className="text-slate2/60">({kind.replace(/_/g, " ")})</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

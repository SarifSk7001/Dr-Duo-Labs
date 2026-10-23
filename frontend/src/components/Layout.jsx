import { Link, Navigate, Outlet, useNavigate, useLocation } from "react-router-dom";
import { api, session } from "../services/api.js";

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function Layout() {
  const navigate = useNavigate();
  if (!session.token) return <Navigate to="/login" replace />;

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    session.clear();
    navigate("/login");
  };

  const location = useLocation();
  const navLink = (to, label) => (
    <Link
      key={to}
      to={to}
      className={`text-xs font-semibold transition-colors duration-150 ${
        location.pathname === to || location.pathname.startsWith(to + "/")
          ? "text-ibm"
          : "text-slate-500 hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7]">

      {/* ── Navbar ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-[60px] border-b border-[#e4e7ec] bg-white/95 backdrop-blur-sm">
        <div className="flex h-full items-center justify-between px-6">

          {/* Brand */}
          <Link to="/" className="group flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ibm shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:scale-105">
              <svg viewBox="0 0 20 20" fill="white" className="h-4 w-4">
                <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84Z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold leading-none tracking-tight text-ink">Experiment Exchange</p>
              <p className="mt-0.5 text-[10px] leading-none text-slate-400">with Hypothesia</p>
            </div>
          </Link>

          {/* Nav links */}
          <nav className="hidden items-center gap-4 md:flex">
            {navLink("/repository", "Repository")}
            {navLink("/compare", "Compare")}
            {navLink("/graph", "Graph")}
            {navLink("/hypotheses", "Hypothesis Lab")}
            {navLink("/ai-check", "AI check")}
            {navLink("/eval", "Evaluation")}
            {navLink("/audit", "Audit")}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* User name — hidden on small screens */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ibm text-[11px] font-bold text-white ring-2 ring-ibm/20">
                {initials(session.user?.name)}
              </div>
              <div className="leading-tight">
                <p className="text-xs font-semibold text-ink leading-none">{session.user?.name}</p>
                <p className="mt-0.5 text-[10px] leading-none text-slate-400">{session.user?.role ?? "Researcher"}</p>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden h-5 w-px bg-[#e4e7ec] sm:block" />

            {/* Sign out */}
            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-lg border border-[#e4e7ec] bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 shadow-sm transition-all duration-150 hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-none"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h5a.75.75 0 0 1 0 1.5h-5A.75.75 0 0 1 2 4.75ZM2 11.25a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5a.75.75 0 0 1-.75-.75Zm8.22-7.53a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 1 1-1.06-1.06L12.44 8.5H6.75a.75.75 0 0 1 0-1.5h5.69L10.22 4.78a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page ───────────────────────────────────────── */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

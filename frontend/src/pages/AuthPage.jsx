import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, session } from "../services/api.js";

const P = {
  mail: "M3 7l9 6 9-6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 20a8 8 0 0 1 16 0",
  eye: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 5.1A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4M6.5 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  check: "M5 13l4 4L19 7",
  alert: "M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  flask: "M9 3h6M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2.2h12.4a1.5 1.5 0 0 0 1.3-2.2L14 9V3",
  search: "M21 21l-4.35-4.35M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  sparkle: "M9.8 15.9 9 18.75l-.8-2.85a4.5 4.5 0 0 0-3.1-3.1L2.25 12l2.85-.8a4.5 4.5 0 0 0 3.1-3.1L9 5.25l.8 2.85a4.5 4.5 0 0 0 3.1 3.1l2.85.8-2.85.8a4.5 4.5 0 0 0-3.1 3.1Z",
  shield: "M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3ZM9 12l2 2 4-4",
  arrow: "M5 12h14M13 6l6 6-6 6",
};

function Icon({ d, className = "h-5 w-5", stroke = 1.8 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-30" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4Z" />
    </svg>
  );
}

/* Floating-label input */
function FloatInput({ id, label, icon, right, ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-200 [.group:focus-within_&]:text-ibm">
        <Icon d={icon} className="h-[18px] w-[18px]" />
      </span>
      <input
        id={id}
        placeholder=" "
        className="peer w-full rounded-xl border border-[#d0d5dd] bg-white pb-2 pl-11 pr-11 pt-5 text-sm text-ink shadow-sm outline-none transition-all duration-200 hover:border-slate-400 focus:border-ibm focus:ring-4 focus:ring-ibm/10"
        {...props}
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-11 top-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition-all duration-200 peer-placeholder-shown:top-[15px] peer-placeholder-shown:text-sm peer-placeholder-shown:font-normal peer-placeholder-shown:normal-case peer-placeholder-shown:tracking-normal peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-wider peer-focus:text-ibm"
      >
        {label}
      </label>
      {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  );
}

function strengthOf(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
const STRENGTH = [
  { label: "Too weak", bar: "bg-red-400", text: "text-red-500" },
  { label: "Weak", bar: "bg-orange-400", text: "text-orange-500" },
  { label: "Fair", bar: "bg-amber-400", text: "text-amber-500" },
  { label: "Good", bar: "bg-lime-500", text: "text-lime-600" },
  { label: "Strong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

const FEATURES = [
  { icon: P.search, title: "Search what others tried", body: "Semantic search across every record, failures included." },
  { icon: P.sparkle, title: "Challenge every hypothesis", body: "AI critique grounded only in evidence you can access." },
  { icon: P.shield, title: "Private by default", body: "Your records stay yours until you choose to share them." },
];

export default function AuthPage({ mode }) {
  const isLogin = mode === "login";
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [errKey, setErrKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const strength = useMemo(() => strengthOf(form.password), [form.password]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = isLogin ? { email: form.email, password: form.password } : form;
      session.save(await api.post(isLogin ? "/auth/login" : "/auth/register", body));
      setDone(true);
      setTimeout(() => navigate("/"), 500);
    } catch (err) {
      setError(err.message);
      setErrKey((k) => k + 1);
      setBusy(false);
    }
  };

  const useDemo = () => setForm({ ...form, email: "demo@example.com", password: "demo12345" });

  return (
    <div className="au-root grid min-h-screen bg-[#f4f5f7] lg:grid-cols-[1.1fr_1fr]">
      <style>{`
        @keyframes au-float-a{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(60px,40px,0) scale(1.15)}}
        @keyframes au-float-b{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-60px,30px,0) scale(1.1)}}
        @keyframes au-bob{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-12px) rotate(var(--r,0deg))}}
        @keyframes au-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
        @keyframes au-fade{from{opacity:0}to{opacity:1}}
        @keyframes au-grid{to{background-position:36px 36px}}
        @keyframes au-gradient{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes au-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(3px)}30%,50%,70%{transform:translateX(-6px)}40%,60%{transform:translateX(6px)}}
        @keyframes au-ping{0%{transform:scale(.8);opacity:.7}100%{transform:scale(2.4);opacity:0}}
        @keyframes au-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
        @keyframes au-draw{from{stroke-dashoffset:30}to{stroke-dashoffset:0}}
        .au-rise{animation:au-rise .8s cubic-bezier(.16,1,.3,1) both}
        .au-fade{animation:au-fade .8s ease both}
        .au-shake{animation:au-shake .5s cubic-bezier(.36,.07,.19,.97) both}
        .au-grid{background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);background-size:36px 36px;animation:au-grid 8s linear infinite;-webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 78%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 78%)}
        .au-gradient-text{background:linear-gradient(90deg,#fff 0%,#a5c8ff 25%,#d8c8ff 50%,#a5c8ff 75%,#fff 100%);background-size:200% auto;-webkit-background-clip:text;background-clip:text;color:transparent;animation:au-gradient 7s linear infinite}
        .au-shine{position:relative;overflow:hidden}
        .au-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.3) 50%,transparent 70%);transform:translateX(-120%);transition:transform .8s}
        .au-shine:hover:not(:disabled)::after{transform:translateX(120%)}
        .au-tick{stroke-dasharray:30;animation:au-draw .45s ease-out .05s both}
        @media (prefers-reduced-motion:reduce){.au-root *{animation:none!important;transition:none!important}}
      `}</style>

      {/* ══ LEFT: brand panel ═══════════════════════════════ */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0a2647] via-[#0f3460] to-[#1a3f7a] p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="au-grid pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-ibm/40 blur-3xl" style={{ animation: "au-float-a 14s ease-in-out infinite" }} />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-violet-500/30 blur-3xl" style={{ animation: "au-float-b 18s ease-in-out infinite" }} />

        <div className="au-fade relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md">
            <Icon d={P.flask} className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-none tracking-tight text-white">Experiment Exchange</p>
            <p className="mt-1 text-[10px] leading-none text-white/55">with Hypothesia</p>
          </div>
        </div>

        <div className="relative my-10">
          <h1 className="au-rise text-4xl font-extrabold leading-[1.12] tracking-tight xl:text-5xl" style={{ animationDelay: "100ms" }}>
            <span className="au-gradient-text">Learn from every experiment.</span>
            <br />
            <span className="text-white">Challenge every hypothesis.</span>
          </h1>
          <p className="au-rise mt-5 max-w-md text-sm leading-relaxed text-white/65" style={{ animationDelay: "220ms" }}>
            Search what others tried, including what failed. Test your hypothesis against recorded evidence, plan the
            next informative experiment, and add the result back.
          </p>

          <ul className="mt-9 space-y-4">
            {FEATURES.map((f, i) => (
              <li key={f.title} className="au-rise flex items-start gap-3.5" style={{ animationDelay: `${340 + i * 120}ms` }}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-sky-200 backdrop-blur-md">
                  <Icon d={f.icon} className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs text-white/55">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Floating preview cards */}
        <div className="relative h-36">
          <div className="absolute left-0 top-2 w-60 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl" style={{ "--r": "-3deg", animation: "au-bob 6s ease-in-out infinite" }}>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="font-mono text-white/60">EXP-004</span>
              <span className="rounded-full bg-red-400/20 px-2 py-0.5 font-semibold text-red-300">contradicted</span>
            </div>
            <p className="mt-2 text-xs font-semibold leading-snug text-white">Connection pool size 10 vs 50</p>
            <p className="mt-1 text-[10px] text-white/50">Failed results are first-class records.</p>
          </div>
          <div className="absolute left-48 top-12 w-56 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-2xl shadow-black/20 backdrop-blur-xl" style={{ "--r": "2.5deg", animation: "au-bob 7s ease-in-out -2s infinite" }}>
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-white/70">AI critique</span>
              <span className="flex items-center gap-1 text-emerald-300"><Icon d={P.check} className="h-3 w-3" stroke={2.6} /> refs verified</span>
            </div>
            <div className="mt-2.5 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-white/20" />
              <div className="h-1.5 w-4/5 rounded-full bg-white/15" />
              <div className="h-1.5 w-3/5 rounded-full bg-white/10" />
            </div>
          </div>
        </div>
      </aside>

      {/* ══ RIGHT: form ═════════════════════════════════════ */}
      <main className="relative flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-ibm/10 blur-3xl lg:hidden" />

        <div className="au-rise relative w-full max-w-md" style={{ animationDelay: "150ms" }}>
          {/* Mobile brand */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ibm text-white shadow-md"><Icon d={P.flask} className="h-5 w-5" /></div>
            <div>
              <p className="text-sm font-bold leading-none tracking-tight text-ink">Experiment Exchange</p>
              <p className="mt-1 text-[10px] leading-none text-slate-400">with Hypothesia</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e4e7ec] bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
            {/* Segmented switch with sliding indicator */}
            <div className="relative mb-7 grid grid-cols-2 rounded-xl bg-[#f1f3f6] p-1 text-center text-sm font-semibold">
              <span
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-transform duration-300 ease-out"
                style={{ transform: isLogin ? "translateX(0)" : "translateX(100%)" }}
              />
              <Link to="/login" className={`relative z-10 rounded-lg py-2 transition-colors ${isLogin ? "text-ink" : "text-slate-400 hover:text-ink"}`}>Log in</Link>
              <Link to="/register" className={`relative z-10 rounded-lg py-2 transition-colors ${!isLogin ? "text-ink" : "text-slate-400 hover:text-ink"}`}>Sign up</Link>
            </div>

            <div key={mode} className="au-rise">
              <h2 className="text-2xl font-extrabold tracking-tight text-ink">{isLogin ? "Welcome back" : "Create your account"}</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {isLogin ? "Log in to continue to your research workspace." : "Start recording, searching and challenging experiments."}
              </p>

              <form onSubmit={submit} className="group mt-7 space-y-4" noValidate={false}>
                {!isLogin && (
                  <FloatInput id="name" label="Full name" icon={P.user} type="text" autoComplete="name" required value={form.name} onChange={set("name")} />
                )}
                <FloatInput id="email" label="Email address" icon={P.mail} type="email" autoComplete="email" required value={form.email} onChange={set("email")} />

                <div>
                  <FloatInput
                    id="password" label="Password" icon={P.lock}
                    type={show ? "text" : "password"} autoComplete={isLogin ? "current-password" : "new-password"}
                    required minLength={8} maxLength={72} value={form.password} onChange={set("password")}
                    onKeyUp={(e) => setCaps(e.getModifierState?.("CapsLock") || false)}
                    onBlur={() => setCaps(false)}
                    right={
                      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-[#f1f3f6] hover:text-ink">
                        <Icon d={show ? P.eyeOff : P.eye} className="h-[18px] w-[18px]" />
                      </button>
                    }
                  />
                  {caps && (
                    <p className="au-fade mt-1.5 flex items-center gap-1.5 text-xs font-medium text-amber-600">
                      <Icon d={P.alert} className="h-3.5 w-3.5" /> Caps Lock is on
                    </p>
                  )}
                  {!isLogin && (
                    <div className="mt-3">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eceff3]">
                            <span
                              className={`block h-full rounded-full transition-all duration-500 ${STRENGTH[strength].bar}`}
                              style={{ width: form.password && i < strength + (strength === 0 ? 1 : 0) ? "100%" : "0%" }}
                            />
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 flex justify-between text-xs">
                        <span className="text-slate-400">8 to 72 characters</span>
                        {form.password && <span className={`font-semibold ${STRENGTH[strength].text}`}>{STRENGTH[strength].label}</span>}
                      </p>
                    </div>
                  )}
                </div>

                {error && (
                  <div key={errKey} role="alert" className="au-shake flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800">
                    <Icon d={P.alert} className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  disabled={busy || done}
                  className={`au-shine group/btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                    done ? "bg-emerald-500 shadow-emerald-500/30" : "bg-gradient-to-r from-ibm to-[#3b82d4] shadow-ibm/30 disabled:opacity-80"
                  }`}
                >
                  {done ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" style={{ animation: "au-pop .4s ease-out both" }}>
                        <path className="au-tick" d={P.check} />
                      </svg>
                      Success, opening your workspace
                    </>
                  ) : busy ? (
                    <><Spinner /> Please wait</>
                  ) : (
                    <>
                      {isLogin ? "Log in" : "Create account"}
                      <Icon d={P.arrow} className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-1" stroke={2.2} />
                    </>
                  )}
                </button>

                {isLogin && (
                  <button type="button" onClick={useDemo}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#d0d5dd] py-2.5 text-xs font-semibold text-slate-500 transition-all duration-200 hover:border-ibm/50 hover:bg-ibm/5 hover:text-ibm">
                    <Icon d={P.sparkle} className="h-3.5 w-3.5" /> Fill in demo account
                  </button>
                )}
              </form>

              <p className="mt-7 text-center text-sm text-slate-500">
                {isLogin ? "New here? " : "Already registered? "}
                <Link className="font-semibold text-ibm underline-offset-2 hover:underline" to={isLogin ? "/register" : "/login"}>
                  {isLogin ? "Create an account" : "Log in"}
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-400">
            Protected by hashed passwords and signed session tokens.
          </p>
        </div>
      </main>
    </div>
  );
}

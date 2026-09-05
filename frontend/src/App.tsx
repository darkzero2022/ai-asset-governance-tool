import { FormEvent, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import Bootstrap from "./pages/Bootstrap";
import { apiFetch } from "./api/client";
import { onUnauthorized } from "./queries/queryClient";
import { queryKeys } from "./queries/keys";
import { useCurrentUserQuery } from "./queries/auth";
import type { CurrentUser } from "@aibom/shared";

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Assets", path: "/assets" },
  { label: "Risk Register", path: "/risks" },
  { label: "Projects", path: "/projects" },
  { label: "Users", path: "/users", adminOnly: true },
];

/**
 * The root layout route. Owns only what's genuinely cross-cutting — the auth
 * token, the current user, and a shared error banner. Every other page's
 * server data lives in that page's own route component (router.tsx) via
 * TanStack Query, not here: this file used to hold ~35 useState hooks and
 * every mutation function for the whole app (see git history pre-D2) —
 * that's exactly the "god component" shape the enhancement plan calls out.
 */
function App() {
  const [token, setToken] = useState(() => localStorage.getItem("aibomToken") ?? "");
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: currentUser = null } = useCurrentUserQuery(token);

  useEffect(() => onUnauthorized(() => {
    localStorage.removeItem("aibomToken");
    setToken("");
  }), []);

  useEffect(() => {
    if (token) return;
    apiFetch<{ needsBootstrap: boolean }>("/auth/bootstrap-status")
      .then((data) => setNeedsBootstrap(Boolean(data.needsBootstrap)))
      .catch(() => setNeedsBootstrap(false));
  }, [token]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");

    try {
      const result = await apiFetch<{ token: string; user: CurrentUser }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      queryClient.setQueryData(queryKeys.currentUser(), result.user);
      localStorage.setItem("aibomToken", result.token);
      setToken(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  if (!token && needsBootstrap === true) {
    return (
      <Bootstrap
        onComplete={(newToken) => {
          localStorage.setItem("aibomToken", newToken);
          setToken(newToken);
          setNeedsBootstrap(false);
        }}
      />
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100">
        <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI-BOM Governance</p>
          <h1 className="text-4xl font-semibold tracking-tight">Sign in to manage AI assets</h1>
          <form onSubmit={login} className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/40">
            <label className="block text-sm text-slate-300" htmlFor="email">Email</label>
            <input id="email" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" value={email} onChange={(event) => setEmail(event.target.value)} />
            <label className="mt-4 block text-sm text-slate-300" htmlFor="password">Password</label>
            <input id="password" className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
            <button className="mt-6 w-full rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200">Sign in</button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-700">AI-BOM Governance</p>
            <h1 className="text-3xl font-semibold tracking-tight">AI Asset Inventory</h1>
          </div>
          <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium" onClick={() => { localStorage.removeItem("aibomToken"); setToken(""); }}>
            Sign out
          </button>
          <nav className="flex flex-wrap gap-3 text-sm font-semibold">
            {navItems.filter((item) => !item.adminOnly || currentUser?.role === "ADMIN").map((item) => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button key={item.path} className={`rounded-lg border px-4 py-2 ${active ? "border-cyan-700 bg-cyan-50 text-cyan-800" : "border-slate-300"}`} onClick={() => navigate(item.path)}>
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {error && <div className="mx-auto max-w-7xl px-6 pt-6"><p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p></div>}
      <Suspense fallback={<div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500">Loading…</div>}>
        <Outlet context={{ token, currentUser, error, setError }} />
      </Suspense>
    </main>
  );
}

export type AppOutletContext = {
  token: string;
  currentUser: CurrentUser | null;
  error: string;
  setError: (message: string) => void;
};

export default App;

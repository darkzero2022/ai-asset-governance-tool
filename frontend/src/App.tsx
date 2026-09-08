import { FormEvent, Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { CurrentUser } from "@aibom/shared";
import { ShieldCheck } from "lucide-react";
import Bootstrap from "./pages/Bootstrap";
import { apiFetch } from "./api/client";
import { onUnauthorized } from "./queries/queryClient";
import { queryKeys } from "./queries/keys";
import { useCurrentUserQuery } from "./queries/auth";
import { AppShell } from "./components/shell/AppShell";
import { Button } from "./components/ui/Button";
import { Input } from "./components/ui/Field";
import { SkeletonRows } from "./components/ui/Skeleton";
import { toast } from "./components/ui/toastStore";
import { useTheme } from "./theme/useTheme";

/**
 * The root layout route. Owns only what's genuinely cross-cutting — the auth
 * token, the current user, and the theme. Every other page's server data
 * lives in that page's own route component (router.tsx) via TanStack Query,
 * not here: this file used to hold ~35 useState hooks and every mutation
 * function for the whole app (see git history pre-D2) — that's exactly the
 * "god component" shape the enhancement plan calls out.
 */
function App() {
  const [token, setToken] = useState(() => localStorage.getItem("aibomToken") ?? "");
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [theme, toggleTheme] = useTheme();
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

  function signOut() {
    localStorage.removeItem("aibomToken");
    setToken("");
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
      <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
        <section className="w-full max-w-sm">
          <div className="mb-6 flex flex-col items-center text-center">
            <ShieldCheck className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">AI-BOM Governance</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to manage AI assets</h1>
          </div>
          <form onSubmit={login} className="rounded-lg border border-border bg-surface p-6 shadow-card">
            <div className="space-y-4">
              <Input id="email" label="Email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" />
              <Input id="password" label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </div>
            {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
            <Button type="submit" variant="primary" className="mt-6 w-full">Sign in</Button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <AppShell currentUser={currentUser} token={token} theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut}>
      <Suspense fallback={<div className="mx-auto max-w-7xl px-6 py-8"><SkeletonRows rows={6} /></div>}>
        <Outlet context={{ token, currentUser, setError: (message: string) => toast.error(message) }} />
      </Suspense>
    </AppShell>
  );
}

export type AppOutletContext = {
  token: string;
  currentUser: CurrentUser | null;
  setError: (message: string) => void;
};

export default App;

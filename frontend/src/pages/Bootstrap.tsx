import { FormEvent, useState } from "react";
import { apiFetch } from "../api/client";

export default function Bootstrap({ onComplete }: { onComplete: (token: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ token: string }>("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      onComplete(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">AI-BOM Governance</p>
        <h1 className="text-4xl font-semibold tracking-tight">Create your administrator account</h1>
        <p className="mt-3 text-sm text-slate-400">
          This is the first time the app has run. Set up the administrator login — you can add more users afterwards.
        </p>
        <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-cyan-950/40">
          <label className="block text-sm text-slate-300" htmlFor="bootstrap-name">Name</label>
          <input
            id="bootstrap-name"
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Administrator"
          />
          <label className="mt-4 block text-sm text-slate-300" htmlFor="bootstrap-email">Email</label>
          <input
            id="bootstrap-email"
            type="email"
            required
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label className="mt-4 block text-sm text-slate-300" htmlFor="bootstrap-password">Password</label>
          <input
            id="bootstrap-password"
            type="password"
            required
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <label className="mt-4 block text-sm text-slate-300" htmlFor="bootstrap-confirm">Confirm password</label>
          <input
            id="bootstrap-confirm"
            type="password"
            required
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
          <button
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-cyan-300 px-4 py-2 font-semibold text-slate-950 hover:bg-cyan-200 disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create account and sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PASSWORD_POLICY_HINT } from "@aibom/shared";
import { apiFetch } from "../api/client";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";

export default function Bootstrap({ onComplete }: { onComplete: (accessToken: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiFetch<{ accessToken: string }>("/auth/bootstrap", {
        method: "POST",
        body: JSON.stringify({ name: name || undefined, email, password }),
      });
      onComplete(result.accessToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6 text-text">
      <section className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <ShieldCheck className="mb-3 h-10 w-10 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">AI-BOM Governance</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Create your administrator account</h1>
          <p className="mt-2 text-sm text-subtle">
            This is the first time the app has run. Set up the administrator login — you can add more users afterwards.
          </p>
        </div>
        <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <div className="space-y-4">
            <Input id="bootstrap-name" label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Administrator" />
            <Input id="bootstrap-email" label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input id="bootstrap-password" label="Password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} hint={PASSWORD_POLICY_HINT} autoComplete="new-password" />
            <Input id="bootstrap-confirm" label="Confirm password" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          {error && <p className="mt-4 text-sm text-danger" role="alert">{error}</p>}
          <Button type="submit" variant="primary" disabled={submitting} className="mt-6 w-full">
            {submitting ? "Creating…" : "Create account and sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}

import { FormEvent, useEffect, useState } from "react";

type User = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

const emptyForm = { email: "", name: "", role: "VIEWER", password: "" };
const roles = ["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"];

export default function Users({ apiBaseUrl, token }: { apiBaseUrl: string; token: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function api<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(body.error ?? "User request failed");
    }
    if (response.status === 204) return undefined as T;
    return response.json();
  }

  async function loadUsers() {
    const data = await api<{ users: User[] }>("/users");
    setUsers(data.users);
  }

  useEffect(() => {
    loadUsers().catch((err: Error) => setError(err.message));
  }, [apiBaseUrl, token]);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/users", { method: "POST", body: JSON.stringify(form) });
      setForm(emptyForm);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "User create failed");
    }
  }

  async function updateUser(id: string, payload: Record<string, unknown>) {
    setError("");
    try {
      await api(`/users/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "User update failed");
    }
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="mt-1 text-sm text-slate-500">Create users, change roles, deactivate accounts, and set temporary passwords.</p>
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">{error}</p>}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="py-3">Name</th><th>Email</th><th>Role</th><th>Status</th><th>Password Reset</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="py-3 font-medium">{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    <select className="rounded-lg border border-slate-300 px-2 py-1" value={user.role} onChange={(event) => updateUser(user.id, { role: event.target.value })}>
                      {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </td>
                  <td>{user.active ? "Active" : "Inactive"}</td>
                  <td><input className="w-40 rounded-lg border border-slate-300 px-2 py-1" type="password" placeholder="Temporary password" value={passwords[user.id] ?? ""} onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })} /></td>
                  <td className="space-x-2 text-right">
                    <button className="font-semibold text-cyan-700 disabled:opacity-40" disabled={!passwords[user.id]} onClick={() => updateUser(user.id, { password: passwords[user.id] })}>Reset</button>
                    <button className="font-semibold text-slate-700" onClick={() => updateUser(user.id, { active: !user.active })}>{user.active ? "Deactivate" : "Reactivate"}</button>
                  </td>
                </tr>
              ))}
              {!users.length && <tr><td className="py-8 text-center text-slate-500" colSpan={6}>No users found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <form onSubmit={createUser} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-semibold">Create User</h2>
        <div className="mt-4 grid gap-4">
          <Field label="Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} />
          <Field label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <label className="block text-sm font-medium text-slate-700">Role<select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{roles.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
          <Field label="Temporary Password" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        </div>
        <button className="mt-5 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Create user</button>
      </form>
    </section>
  );
}

function Field(props: { label: string; value: string; type?: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-medium text-slate-700">{props.label}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-950" type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} /></label>;
}

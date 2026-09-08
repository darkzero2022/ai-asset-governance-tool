import { FormEvent, useState } from "react";
import { useCreateUserMutation, useUpdateUserMutation, useUsersQuery, type UserRow } from "../queries/users";
import { PageHeader } from "../components/shell/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select } from "../components/ui/Field";
import { Badge } from "../components/ui/Badge";
import { DataGrid, type Column } from "../components/DataGrid";
import { toast } from "../components/ui/toastStore";

const emptyForm = { email: "", name: "", role: "VIEWER", password: "" };
const roles = ["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"];

export default function Users({ token }: { token: string }) {
  const { data: users = [], isLoading } = useUsersQuery(token);
  const createUser = useCreateUserMutation(token);
  const updateUser = useUpdateUserMutation(token);
  const [form, setForm] = useState(emptyForm);
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  async function submitCreate(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await createUser.mutateAsync(form);
      setForm(emptyForm);
      toast.success("User created", `${form.name} can now sign in.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "User create failed");
    }
  }

  async function submitUpdate(id: string, payload: Record<string, unknown>) {
    setError("");
    try {
      await updateUser.mutateAsync({ id, payload });
    } catch (err) {
      setError(err instanceof Error ? err.message : "User update failed");
    }
  }

  const columns: Column<UserRow>[] = [
    { key: "name", header: "Name", sortValue: (user) => user.name, render: (user) => <span className="font-medium text-text">{user.name}</span> },
    { key: "email", header: "Email", sortValue: (user) => user.email, render: (user) => user.email },
    {
      key: "role",
      header: "Role",
      sortValue: (user) => user.role,
      render: (user) => (
        <Select aria-label={`Role for ${user.name}`} value={user.role} onChange={(event) => submitUpdate(user.id, { role: event.target.value })} className="w-40">
          {roles.map((role) => <option key={role} value={role}>{role}</option>)}
        </Select>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (user) => (user.active ? 1 : 0),
      render: (user) => <Badge variant={user.active ? "success" : "neutral"}>{user.active ? "Active" : "Inactive"}</Badge>,
    },
    {
      key: "reset",
      header: "Password Reset",
      render: (user) => (
        <div className="flex items-center gap-2">
          <Input
            aria-label={`Temporary password for ${user.name}`}
            type="password"
            placeholder="Temporary password"
            value={passwords[user.id] ?? ""}
            onChange={(event) => setPasswords({ ...passwords, [user.id]: event.target.value })}
            className="w-40"
          />
          <Button variant="secondary" size="sm" disabled={!passwords[user.id]} onClick={() => submitUpdate(user.id, { password: passwords[user.id] })}>
            Reset
          </Button>
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (user) => (
        <Button variant="secondary" size="sm" onClick={() => submitUpdate(user.id, { active: !user.active })}>
          {user.active ? "Deactivate" : "Reactivate"}
        </Button>
      ),
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-6 py-6">
      <PageHeader title="Users" description="Create users, change roles, deactivate accounts, and set temporary passwords." />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader title="All users" />
          <CardBody>
            {error && <p className="mb-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger ring-1 ring-danger/20" role="alert">{error}</p>}
            <DataGrid columns={columns} rows={users} rowKey={(user) => user.id} isLoading={isLoading} emptyTitle="No users found." defaultSortKey="name" compact={false} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Create user" />
          <form onSubmit={submitCreate}>
            <CardBody className="space-y-4">
              <Input label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              <Input label="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <Select label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {roles.map((role) => <option key={role} value={role}>{role}</option>)}
              </Select>
              <Input label="Temporary Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
              <Button type="submit" variant="primary" className="w-full">Create user</Button>
            </CardBody>
          </form>
        </Card>
      </div>
    </section>
  );
}

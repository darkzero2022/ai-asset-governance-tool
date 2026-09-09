import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PASSWORD_POLICY_HINT } from "@aibom/shared";
import { PageHeader } from "../components/shell/PageHeader";
import { Card, CardBody } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Field";
import { toast } from "../components/ui/toastStore";
import { useChangePasswordMutation } from "../queries/auth";

export default function ChangePassword({ token, forced }: { token: string; forced: boolean }) {
  const navigate = useNavigate();
  const changePassword = useChangePasswordMutation(token);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (next !== confirm) {
      setError("The new passwords do not match.");
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      toast.success("Password changed", "You've been signed out of your other sessions.");
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the password.");
    }
  }

  return (
    <section className="mx-auto max-w-lg px-6 py-6">
      <PageHeader
        title="Change password"
        description={
          forced
            ? "An administrator requires you to set a new password before continuing."
            : "Changing your password signs you out of every other device."
        }
      />
      <Card>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
              required
            />
            <Input
              label="New password"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              required
              hint={PASSWORD_POLICY_HINT}
            />
            <Input
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={changePassword.isPending}
              className="w-full"
            >
              {changePassword.isPending ? "Saving…" : "Change password"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </section>
  );
}

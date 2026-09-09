import { Link } from "react-router-dom";
import { KeyRound, LogOut, Monitor } from "lucide-react";
import { PageHeader } from "../components/shell/PageHeader";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Button, buttonVariants } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonRows } from "../components/ui/Skeleton";
import { toast } from "../components/ui/toastStore";
import { clearSession } from "../auth/session";
import { useLogoutAllMutation, useRevokeSessionMutation, useSessionsQuery } from "../queries/auth";

export default function Account({ token }: { token: string }) {
  const { data: sessions = [], isPending } = useSessionsQuery(token);
  const revoke = useRevokeSessionMutation(token);
  const logoutAll = useLogoutAllMutation(token);

  async function onLogoutAll() {
    await logoutAll.mutateAsync();
    clearSession();
  }

  return (
    <section className="mx-auto max-w-3xl px-6 py-6">
      <PageHeader title="Account" description="Manage your password and signed-in sessions." />

      <div className="space-y-6">
        <Card>
          <CardHeader title="Password" />
          <CardBody>
            <p className="text-sm text-subtle">Changing your password signs you out of every other device.</p>
            <Link to="/account/change-password" className={`mt-3 inline-flex ${buttonVariants({ variant: "secondary", size: "sm" })}`}>
              <KeyRound className="h-3.5 w-3.5" /> Change password
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Active sessions"
            action={
              <Button variant="danger" size="sm" onClick={onLogoutAll} disabled={logoutAll.isPending}>
                <LogOut className="h-3.5 w-3.5" /> Log out of all devices
              </Button>
            }
          />
          <CardBody>
            {isPending ? (
              <SkeletonRows rows={3} />
            ) : sessions.length === 0 ? (
              <EmptyState title="No other active sessions." />
            ) : (
              <ul className="space-y-2">
                {sessions.map((session) => (
                  <li key={session.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3 text-sm">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-medium text-text">
                        <Monitor className="h-3.5 w-3.5 text-subtle" />
                        {session.current ? "This device" : "Another device"}
                      </p>
                      <p className="truncate text-xs text-subtle">{session.userAgent || "Unknown client"}</p>
                      <p className="text-xs text-subtle">
                        {session.ip ? `${session.ip} · ` : ""}last used {new Date(session.lastUsedAt).toLocaleString()}
                      </p>
                    </div>
                    {!session.current && (
                      <Button variant="ghost" size="sm" onClick={() => revoke.mutate(session.id, { onSuccess: () => toast.success("Session revoked") })}>
                        Revoke
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

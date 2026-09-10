import { useState } from "react";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { Card, CardBody, CardHeader } from "./ui/Card";
import { Button } from "./ui/Button";
import { Input } from "./ui/Field";
import { toast } from "./ui/toastStore";
import {
  useTotpDisableMutation,
  useTotpEnableMutation,
  useTotpRecoveryCodesMutation,
  useTotpSetupMutation,
  useTotpStatusQuery,
} from "../queries/auth";

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  return (
    <div className="mt-3 rounded-md border border-border bg-bg p-3">
      <p className="text-sm font-medium text-text">Recovery codes</p>
      <p className="mt-1 text-xs text-subtle">
        Store these somewhere safe. Each works once if you lose your authenticator. This is the only
        time they are shown.
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => {
          navigator.clipboard?.writeText(codes.join("\n")).then(
            () => toast.success("Recovery codes copied"),
            () => {},
          );
        }}
      >
        Copy to clipboard
      </Button>
      <Button variant="ghost" size="sm" className="mt-3 ml-2" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

export function TwoFactor({ token }: { token: string }) {
  const status = useTotpStatusQuery(token);
  const setup = useTotpSetupMutation(token);
  const enable = useTotpEnableMutation(token);
  const disable = useTotpDisableMutation(token);
  const regen = useTotpRecoveryCodesMutation(token);

  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disabling, setDisabling] = useState(false);

  const enabled = status.data?.enabled ?? false;

  async function onEnable() {
    try {
      const result = await enable.mutateAsync(code);
      setRecoveryCodes(result.recoveryCodes);
      setup.reset();
      setCode("");
      toast.success("Two-factor authentication is on");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not verify that code");
    }
  }

  async function onDisable() {
    try {
      await disable.mutateAsync(password);
      setDisabling(false);
      setPassword("");
      setRecoveryCodes(null);
      toast.success("Two-factor authentication is off");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password incorrect");
    }
  }

  async function onRegen() {
    try {
      const result = await regen.mutateAsync(password);
      setRecoveryCodes(result.recoveryCodes);
      setPassword("");
      toast.success("New recovery codes generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Password incorrect");
    }
  }

  return (
    <Card>
      <CardHeader
        title="Two-factor authentication"
        action={
          <span className="flex items-center gap-1.5 text-sm text-subtle">
            {enabled ? (
              <>
                <ShieldCheck className="h-4 w-4 text-success" /> On
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4" /> Off
              </>
            )}
          </span>
        }
      />
      <CardBody>
        {!enabled && !setup.data && (
          <>
            <p className="text-sm text-subtle">
              Protect your account with a time-based one-time code from an authenticator app.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              disabled={setup.isPending}
              onClick={() => setup.mutate()}
            >
              Set up
            </Button>
          </>
        )}

        {!enabled && setup.data && (
          <div className="space-y-3">
            <p className="text-sm text-subtle">
              Scan this with your authenticator app, then enter the 6-digit code it shows.
            </p>
            <img
              src={setup.data.qrDataUri}
              alt="TOTP QR code"
              className="rounded-md border border-border bg-white p-2"
              width={200}
              height={200}
            />
            <p className="break-all font-mono text-xs text-subtle">
              Manual key: {setup.data.secret}
            </p>
            <Input
              id="totp-enable-code"
              label="6-digit code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <div>
              <Button variant="primary" size="sm" disabled={enable.isPending} onClick={onEnable}>
                Turn on
              </Button>
              <Button variant="ghost" size="sm" className="ml-2" onClick={() => setup.reset()}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {enabled && !disabling && (
          <div className="space-y-2">
            <p className="text-sm text-subtle">
              A code is required at every sign-in. {status.data?.recoveryCodesRemaining ?? 0}{" "}
              recovery code(s) left.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDisabling(true)}>
                Turn off
              </Button>
            </div>
            <div className="mt-3 border-t border-border pt-3">
              <p className="text-sm font-medium text-text">Regenerate recovery codes</p>
              <Input
                id="totp-regen-password"
                label="Confirm your password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                disabled={regen.isPending || !password}
                onClick={onRegen}
              >
                Generate new codes
              </Button>
            </div>
          </div>
        )}

        {enabled && disabling && (
          <div className="space-y-2">
            <Input
              id="totp-disable-password"
              label="Confirm your password to turn off 2FA"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
            <div>
              <Button
                variant="danger"
                size="sm"
                disabled={disable.isPending || !password}
                onClick={onDisable}
              >
                Turn off two-factor
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="ml-2"
                onClick={() => {
                  setDisabling(false);
                  setPassword("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {recoveryCodes && (
          <RecoveryCodes codes={recoveryCodes} onDone={() => setRecoveryCodes(null)} />
        )}
      </CardBody>
    </Card>
  );
}

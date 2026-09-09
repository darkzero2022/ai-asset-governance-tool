import { Issuer, type Client } from "openid-client";

type OidcState = {
  nonce: string;
  codeVerifier: string;
  expiresAt: number;
};

export const oidcStates = new Map<string, OidcState>();
let oidcClientPromise: Promise<Client> | undefined;

export function oidcConfigured() {
  return Boolean(
    process.env.OIDC_ISSUER_URL &&
    process.env.OIDC_CLIENT_ID &&
    process.env.OIDC_CLIENT_SECRET &&
    process.env.OIDC_REDIRECT_URI,
  );
}

export async function oidcClient() {
  if (!oidcConfigured()) throw new Error("OIDC is not configured");
  oidcClientPromise ??= Issuer.discover(process.env.OIDC_ISSUER_URL!).then(
    (issuer) =>
      new issuer.Client({
        client_id: process.env.OIDC_CLIENT_ID!,
        client_secret: process.env.OIDC_CLIENT_SECRET!,
        redirect_uris: [process.env.OIDC_REDIRECT_URI!],
        response_types: ["code"],
      }),
  );
  return oidcClientPromise;
}

export function cleanExpiredOidcStates() {
  const now = Date.now();
  for (const [state, value] of oidcStates.entries()) {
    if (value.expiresAt <= now) oidcStates.delete(state);
  }
}

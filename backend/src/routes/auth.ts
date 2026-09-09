import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generators } from "openid-client";
import { bootstrapSchema, changePasswordSchema } from "@aibom/shared";
import { prisma } from "../prisma.js";
import { requireAuth, signAccessToken } from "../auth.js";
import { AppError, badRequest, notImplemented, unauthorized, unprocessable } from "../httpError.js";
import { audit } from "../lib/audit.js";
import { oidcStates, oidcClient, oidcConfigured, cleanExpiredOidcStates } from "../lib/oidc.js";
import { loginRateLimit } from "../middleware/rateLimit.js";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  createSession,
  listSessions,
  revokeAllForUser,
  revokeSession,
  revokeSessionByToken,
  rotateSession,
  setRefreshCookie,
} from "../lib/session.js";

const router = express.Router();

const MAX_FAILED_ATTEMPTS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function readRefreshCookie(req: express.Request): string | undefined {
  return (req as express.Request & { cookies?: Record<string, string> }).cookies?.[REFRESH_COOKIE];
}

/** Reject a cross-site POST to the refresh/logout endpoints. The SameSite=Strict
 *  cookie already blocks this; the custom header is belt-and-suspenders (it
 *  cannot be set on a simple cross-origin request without a CORS preflight). */
function requireFetchHeader(req: express.Request): void {
  if (!req.header("x-requested-with")) {
    throw new AppError(400, "MISSING_REQUEST_HEADER", "Missing X-Requested-With header");
  }
}

async function issueSession(
  res: express.Response,
  req: express.Request,
  user: {
    id: string;
    email: string;
    role: "ADMIN" | "RISK_OWNER" | "APPROVER" | "VIEWER";
    name: string;
    tokenVersion: number;
    mustChangePassword: boolean;
  },
) {
  const rawRefresh = await createSession(user.id, req);
  setRefreshCookie(res, rawRefresh);
  return {
    accessToken: signAccessToken(
      { id: user.id, email: user.email, role: user.role },
      user.tokenVersion,
    ),
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    mustChangePassword: user.mustChangePassword,
  };
}

router.post("/auth/login", loginRateLimit, async (req, res, next) => {
  try {
    const body = z
      .object({ email: z.string().email(), password: z.string().min(1) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (user?.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppError(
        423,
        "ACCOUNT_LOCKED",
        `Account locked after too many failed attempts. Try again after ${user.lockedUntil.toISOString()}.`,
        {
          lockedUntil: user.lockedUntil.toISOString(),
        },
      );
    }

    if (!user || !user.active || !(await bcrypt.compare(body.password, user.passwordHash))) {
      if (user) {
        const attempts = user.failedLoginAttempts + 1;
        if (attempts >= MAX_FAILED_ATTEMPTS) {
          const lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil },
          });
          throw new AppError(
            423,
            "ACCOUNT_LOCKED",
            `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts. Try again after ${lockedUntil.toISOString()}.`,
            {
              lockedUntil: lockedUntil.toISOString(),
            },
          );
        }
        await prisma.user.update({
          where: { id: user.id },
          data: { failedLoginAttempts: attempts },
        });
      }
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    res.json(await issueSession(res, req, user));
  } catch (error) {
    next(error);
  }
});

router.post("/auth/refresh", async (req, res, next) => {
  try {
    requireFetchHeader(req);
    const rotated = await rotateSession(readRefreshCookie(req), req);
    if (!rotated) {
      clearRefreshCookie(res);
      throw unauthorized("Session expired");
    }
    const user = await prisma.user.findUnique({ where: { id: rotated.userId } });
    if (!user || !user.active) {
      clearRefreshCookie(res);
      throw unauthorized("Session expired");
    }
    setRefreshCookie(res, rotated.rawToken);
    res.json({
      accessToken: signAccessToken(
        { id: user.id, email: user.email, role: user.role },
        user.tokenVersion,
      ),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      mustChangePassword: user.mustChangePassword,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout", async (req, res, next) => {
  try {
    await revokeSessionByToken(readRefreshCookie(req));
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/auth/logout-all", requireAuth, async (req, res, next) => {
  try {
    await revokeAllForUser(req.user!.id);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.get("/auth/sessions", requireAuth, async (req, res, next) => {
  try {
    res.json({ sessions: await listSessions(req.user!.id, readRefreshCookie(req)) });
  } catch (error) {
    next(error);
  }
});

router.delete("/auth/sessions/:id", requireAuth, async (req, res, next) => {
  try {
    const removed = await revokeSession(String(req.params.id), req.user!.id);
    if (!removed) throw new AppError(404, "NOT_FOUND", "Session not found");
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post("/auth/change-password", requireAuth, async (req, res, next) => {
  try {
    const body = changePasswordSchema.parse(req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });

    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
      throw unauthorized("Current password is incorrect");
    }
    if (await bcrypt.compare(body.newPassword, user.passwordHash)) {
      throw unprocessable("New password must be different from the current one");
    }

    // Bump tokenVersion + drop every session, then start a fresh one for the
    // caller so they stay signed in on this device only.
    await revokeAllForUser(user.id);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(body.newPassword, 10), mustChangePassword: false },
    });
    await audit(
      user.id,
      "User",
      user.id,
      "UPDATE",
      { passwordHash: "***" },
      { passwordHash: "***", event: "change-password" },
    );

    res.json(await issueSession(res, req, updated));
  } catch (error) {
    next(error);
  }
});

// First-run setup: when there are no users yet, the SPA shows a "create
// administrator" screen instead of the login form and calls POST /auth/bootstrap.
router.get("/auth/bootstrap-status", async (_req, res, next) => {
  try {
    const userCount = await prisma.user.count();
    res.json({ needsBootstrap: userCount === 0 });
  } catch (error) {
    next(error);
  }
});

router.post("/auth/bootstrap", loginRateLimit, async (req, res, next) => {
  try {
    const body = bootstrapSchema.parse(req.body);

    const user = await prisma.$transaction(async (tx) => {
      if ((await tx.user.count()) > 0) {
        throw new AppError(
          409,
          "ALREADY_BOOTSTRAPPED",
          "An administrator account already exists — sign in instead.",
        );
      }
      return tx.user.create({
        data: {
          email: body.email,
          name: body.name ?? "Administrator",
          role: "ADMIN",
          active: true,
          passwordHash: await bcrypt.hash(body.password, 10),
        },
      });
    });

    res.status(201).json(await issueSession(res, req, user));
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        mustChangePassword: true,
      },
    });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/oidc/login", async (_req, res, next) => {
  try {
    if (!oidcConfigured()) {
      throw notImplemented("OIDC is not configured");
    }

    cleanExpiredOidcStates();
    const client = await oidcClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    oidcStates.set(state, { nonce, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    res.redirect(
      client.authorizationUrl({
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: generators.codeChallenge(codeVerifier),
        code_challenge_method: "S256",
      }),
    );
  } catch (error) {
    next(error);
  }
});

router.get("/auth/oidc/callback", async (req, res, next) => {
  try {
    if (!oidcConfigured()) {
      throw notImplemented("OIDC is not configured");
    }

    cleanExpiredOidcStates();
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const storedState = oidcStates.get(state);

    if (!storedState) {
      throw badRequest("Invalid or expired OIDC state");
    }

    oidcStates.delete(state);
    const client = await oidcClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI!, params, {
      state,
      nonce: storedState.nonce,
      code_verifier: storedState.codeVerifier,
    });
    const claims = tokenSet.claims();
    const email = claims.email;

    if (!email) {
      throw badRequest("OIDC provider did not return an email claim");
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: claims.name ?? email, active: true },
      create: {
        email,
        name: claims.name ?? email,
        role: "VIEWER",
        active: true,
        passwordHash: await bcrypt.hash(generators.random(32), 10),
      },
    });
    const session = await issueSession(res, req, user);
    const redirectUrl = process.env.OIDC_POST_LOGIN_REDIRECT_URL;

    if (redirectUrl) {
      const url = new URL(redirectUrl);
      url.searchParams.set("token", session.accessToken);
      res.redirect(url.toString());
      return;
    }

    res.json(session);
  } catch (error) {
    next(error);
  }
});

export default router;

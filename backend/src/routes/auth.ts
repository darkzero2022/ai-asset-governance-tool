import express from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { generators } from "openid-client";
import { prisma } from "../prisma.js";
import { requireAuth, signToken } from "../auth.js";
import { AppError, badRequest, notImplemented } from "../httpError.js";
import { oidcStates, oidcClient, oidcConfigured, cleanExpiredOidcStates } from "../lib/oidc.js";
import { loginRateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/auth/login", loginRateLimit, async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !user.active || !(await bcrypt.compare(body.password, user.passwordHash))) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid credentials");
    }

    res.json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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
    const body = z
      .object({
        email: z.string().email(),
        name: z.string().min(1).optional(),
        password: z.string().min(8),
      })
      .parse(req.body);

    const user = await prisma.$transaction(async (tx) => {
      if ((await tx.user.count()) > 0) {
        throw new AppError(409, "ALREADY_BOOTSTRAPPED", "An administrator account already exists — sign in instead.");
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

    res.status(201).json({
      token: signToken({ id: user.id, email: user.email, role: user.role }),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

router.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, name: true, role: true, active: true } });
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

    res.redirect(client.authorizationUrl({
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: "S256",
    }));
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
    const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI!, params, { state, nonce: storedState.nonce, code_verifier: storedState.codeVerifier });
    const claims = tokenSet.claims();
    const email = claims.email;

    if (!email) {
      throw badRequest("OIDC provider did not return an email claim");
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: claims.name ?? email, active: true },
      create: { email, name: claims.name ?? email, role: "VIEWER", active: true, passwordHash: await bcrypt.hash(generators.random(32), 10) },
    });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const redirectUrl = process.env.OIDC_POST_LOGIN_REDIRECT_URL;

    if (redirectUrl) {
      const url = new URL(redirectUrl);
      url.searchParams.set("token", token);
      res.redirect(url.toString());
      return;
    }

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});

export default router;

import rateLimit from "express-rate-limit";

// Coarse per-IP throttle on the auth endpoints. The per-account lockout in the
// login handler (backend/src/routes/auth.ts) is the primary defense against
// targeted brute force; this is the blanket one. Disabled under NODE_ENV=test
// so the lockout/rotation tests can drive many attempts from one address.
const limit = Number(process.env.LOGIN_RATE_LIMIT) || 20;

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === "test",
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many authentication attempts, please try again later.",
    },
  },
});

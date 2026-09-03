import { pino } from "pino";
import pinoPretty from "pino-pretty";

// LOG_LEVEL wins; otherwise quiet during tests and info elsewhere.
const level =
  process.env.LOG_LEVEL?.trim().toLowerCase() ||
  (process.env.NODE_ENV === "test" ? "silent" : "info");

const pretty = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

const redact = {
  paths: [
    "req.headers.authorization",
    "req.headers.cookie",
    "*.password",
    "*.passwordHash",
    "*.token",
    "*.jwt",
  ],
  remove: true,
};

// pino-pretty is used as a *synchronous* stream (not a worker transport) so
// short-lived CLI scripts (db:start, the recert job) exit cleanly instead of
// being held open by a transport thread.
export const logger = pretty
  ? pino(
      { level, redact },
      pinoPretty({ colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" }),
    )
  : pino({ level, redact });

import { pino } from "pino";

// LOG_LEVEL wins; otherwise quiet during tests and info elsewhere.
const level =
  process.env.LOG_LEVEL?.trim().toLowerCase() ||
  (process.env.NODE_ENV === "test" ? "silent" : "info");

const pretty = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const logger = pino({
  level,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.jwt",
    ],
    remove: true,
  },
  ...(pretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

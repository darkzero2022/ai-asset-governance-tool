import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { logger } from "../log.js";

type Store = { requestId: string; userId?: string };

const storage = new AsyncLocalStorage<Store>();

/** Per-request id, propagated through async calls. Undefined outside a request. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function getUserId(): string | undefined {
  return storage.getStore()?.userId;
}

/** Attach the authenticated user to the current request's context (called from requireAuth). */
export function setUserId(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}

/**
 * Assigns a request id (honouring an inbound X-Request-Id when it looks safe),
 * echoes it on the response, and runs the rest of the request inside an
 * AsyncLocalStorage store so logs and error responses can reference it.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const inbound = req.header("x-request-id");
  const requestId = inbound && /^[A-Za-z0-9._-]{1,128}$/.test(inbound) ? inbound : randomUUID();
  res.setHeader("X-Request-Id", requestId);
  storage.run({ requestId }, () => next());
};

/** One structured log line per request, keyed by request id and user. */
export const httpLogger: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e5) / 10;
    const record = {
      requestId: getRequestId(),
      userId: getUserId(),
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    };
    if (res.statusCode >= 500) logger.error(record, "request failed");
    else if (res.statusCode >= 400) logger.warn(record, "request rejected");
    else logger.info(record, "request");
  });
  next();
};

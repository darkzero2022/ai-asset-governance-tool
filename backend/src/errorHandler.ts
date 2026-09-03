import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { AppError } from "./httpError.js";
import { logger } from "./log.js";
import { getRequestId } from "./requestContext.js";

/** Terminal 404 — any request that matched no route lands here as an AppError. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError(404, "NOT_FOUND", "Not found"));
};

/**
 * The single error handler. Every failure — thrown AppError, Zod validation
 * failure, known Prisma error, or anything unexpected — becomes
 * `{ error: { code, message, details? }, requestId }` with the right status.
 * 5xx are logged with the request id; the client only ever sees a generic
 * message for unexpected errors.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const requestId = getRequestId();

  let status = 500;
  let code = "INTERNAL";
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = "VALIDATION_FAILED";
    message = "Request validation failed";
    details = err.flatten();
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      status = 404;
      code = "NOT_FOUND";
      message = "Record not found";
    } else if (err.code === "P2002") {
      status = 409;
      code = "CONFLICT";
      message = "That value is already in use";
    } else if (err.code === "P2003") {
      status = 409;
      code = "CONFLICT";
      message = "A related record prevents this change";
    } else {
      status = 400;
      code = "DB_REQUEST_ERROR";
      message = "Database request could not be completed";
    }
  }

  if (status >= 500) {
    logger.error({ err, requestId }, "unhandled error");
  }

  res.status(status).json({
    error: { code, message, ...(details !== undefined ? { details } : {}) },
    requestId,
  });
};

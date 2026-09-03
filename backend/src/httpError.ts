/**
 * An error with an HTTP status and a stable machine-readable code. Throw these
 * from route handlers (they are caught by the try/catch → next(error) pattern)
 * or pass them to next(); the central errorHandler turns them into the response
 * envelope `{ error: { code, message, details? }, requestId }`.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Authentication required") =>
  new AppError(401, "UNAUTHENTICATED", message);
export const forbidden = (message: string) => new AppError(403, "FORBIDDEN", message);
export const notFound = (message: string) => new AppError(404, "NOT_FOUND", message);
export const conflict = (message: string, details?: unknown) =>
  new AppError(409, "CONFLICT", message, details);
export const notImplemented = (message: string) =>
  new AppError(501, "NOT_IMPLEMENTED", message);

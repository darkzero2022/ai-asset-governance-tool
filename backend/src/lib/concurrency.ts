import { AppError } from "../httpError.js";

/**
 * Optimistic-concurrency `where` for an update: the row id, plus the `updatedAt`
 * the client last saw when it sent one. Pair with `updateMany` + `staleWrite()`
 * so a concurrent edit is rejected instead of silently overwritten.
 */
export function lockWhere(id: string, expectedUpdatedAt: string | undefined) {
  return expectedUpdatedAt ? { id, updatedAt: new Date(expectedUpdatedAt) } : { id };
}

export function staleWrite(): AppError {
  return new AppError(409, "STALE_WRITE", "This record changed since you opened it — reload and try again.");
}

import express from "express";
import request from "supertest";
import { ZodError, z } from "zod";
import { Prisma } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { errorHandler, notFoundHandler } from "./errorHandler.js";
import { AppError } from "../httpError.js";
import { logger } from "../log.js";
import { requestContext } from "./requestContext.js";

function appThatThrows(thrower: () => unknown): express.Express {
  const app = express();
  app.use(requestContext);
  app.get("/boom", (_req, _res, next) => {
    try {
      thrower();
      next();
    } catch (err) {
      next(err);
    }
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe("errorHandler", () => {
  it("renders an AppError as the envelope with its status, code and details", async () => {
    const app = appThatThrows(() => {
      throw new AppError(409, "CONFLICT", "Already linked", { id: "x1" });
    });
    const res = await request(app).get("/boom").expect(409);
    expect(res.body).toMatchObject({
      error: { code: "CONFLICT", message: "Already linked", details: { id: "x1" } },
    });
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.headers["x-request-id"]).toBe(res.body.requestId);
  });

  it("maps a ZodError to 422 with flattened details", async () => {
    const app = appThatThrows(() => z.object({ n: z.number() }).parse({ n: "no" }));
    const res = await request(app).get("/boom").expect(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details.fieldErrors.n).toBeDefined();
  });

  it("maps Prisma P2025 to 404", async () => {
    const app = appThatThrows(() => {
      throw new Prisma.PrismaClientKnownRequestError("nope", { code: "P2025", clientVersion: "x" });
    });
    await request(app).get("/boom").expect(404);
  });

  it("hides unexpected errors behind a generic 500 and logs them with the request id", async () => {
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => logger);
    const app = appThatThrows(() => {
      throw new Error("secret internal detail");
    });
    const res = await request(app).get("/boom").expect(500);

    expect(res.body).toMatchObject({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
    expect(res.body).not.toHaveProperty("error.details");
    expect(JSON.stringify(res.body)).not.toContain("secret internal detail");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [payload] = errorSpy.mock.calls[0];
    expect(payload).toMatchObject({ requestId: res.body.requestId });
    expect((payload as { err: Error }).err.message).toBe("secret internal detail");
  });

  it("routes an unmatched path through the envelope as NOT_FOUND", async () => {
    const app = appThatThrows(() => {});
    const res = await request(app).get("/no-such-thing").expect(404);
    expect(res.body.error).toMatchObject({ code: "NOT_FOUND", message: "Not found" });
  });

  it("only ever throws AppError / ZodError instances from the helpers", () => {
    expect(new AppError(400, "X", "y")).toBeInstanceOf(Error);
    expect(() => z.string().parse(1)).toThrow(ZodError);
  });
});

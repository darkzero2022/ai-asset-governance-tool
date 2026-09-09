import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../app.js";
import { prisma } from "../prisma.js";
import { pendingMigrations, readiness } from "./readiness.js";

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /health (liveness)", () => {
  it("is a cheap 200 that does not depend on the database", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("GET /ready (readiness)", () => {
  it("reports ready with both checks passing against the migrated test DB", async () => {
    const res = await request(app).get("/ready").expect(200);
    expect(res.body.status).toBe("ready");
    expect(res.body.checks.database.ok).toBe(true);
    expect(res.body.checks.migrations.ok).toBe(true);
  });

  it("readiness() returns the full check shape", async () => {
    const result = await readiness();
    expect(result).toHaveProperty("checks.database.ok");
    expect(result).toHaveProperty("checks.migrations.ok");
  });
});

describe("pendingMigrations", () => {
  it("is empty when every on-disk migration is applied", () => {
    expect(pendingMigrations(["a", "b", "c"], ["a", "b", "c", "extra"])).toEqual([]);
  });

  it("lists on-disk migrations missing from the applied set, in order", () => {
    expect(pendingMigrations(["a", "b", "c", "d"], ["a", "c"])).toEqual(["b", "d"]);
  });
});

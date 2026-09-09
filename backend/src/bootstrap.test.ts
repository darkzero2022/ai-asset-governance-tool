import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

// Runs against an empty users table (vitest fileParallelism is off, and every
// other DB-backed test file re-seeds its own users in beforeAll).
describe("first-run bootstrap", () => {
  async function wipe() {
    await prisma.governanceWorkflow.deleteMany({});
    await prisma.recertificationSchedule.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.riskControl.deleteMany({});
    await prisma.assetRisk.deleteMany({});
    await prisma.projectRisk.deleteMany({});
    await prisma.projectAsset.deleteMany({});
    await prisma.assetDependency.deleteMany({});
    await prisma.modelCardMetric.deleteMany({});
    await prisma.modelCard.deleteMany({});
    await prisma.risk.deleteMany({});
    await prisma.control.deleteMany({});
    await prisma.project.deleteMany({});
    await prisma.aIAsset.deleteMany({});
    await prisma.user.deleteMany({});
  }

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
    await wipe();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reports needsBootstrap while there are no users", async () => {
    const res = await request(app).get("/api/v1/auth/bootstrap-status").expect(200);
    expect(res.body).toEqual({ needsBootstrap: true });
  });

  it("creates the first admin and returns a usable token", async () => {
    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({
        name: "First Admin",
        email: "first-admin@example.com",
        password: "bootstrap-secret-passphrase",
      })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: "first-admin@example.com", role: "ADMIN" });
    expect(res.body.accessToken).toEqual(expect.any(String));

    await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${res.body.accessToken}`)
      .expect(200);
  });

  it("stops reporting needsBootstrap and rejects a second bootstrap", async () => {
    const status = await request(app).get("/api/v1/auth/bootstrap-status").expect(200);
    expect(status.body).toEqual({ needsBootstrap: false });

    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ email: "second@example.com", password: "another-secret-passphrase" })
      .expect(409);
    expect(res.body.error.code).toBe("ALREADY_BOOTSTRAPPED");
  });

  it("rejects a short password with a 422 envelope", async () => {
    await wipe();
    const res = await request(app)
      .post("/api/v1/auth/bootstrap")
      .send({ email: "x@example.com", password: "short" })
      .expect(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
  });
});

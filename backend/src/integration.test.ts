import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { app } from "./app.js";
import { signToken } from "./auth.js";
import { buildCycloneDxBom, validateCycloneDxBom } from "./cyclonedx.js";
import { prisma } from "./prisma.js";
import { buildSpdxDocument } from "./spdx.js";

const runId = `it-${Date.now()}`;
const roles: Role[] = ["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"];
const tokens = new Map<Role, string>();
const userIds = new Map<Role, string>();

const assetBody = (name: string) => ({
  name,
  version: "1.0.0",
  type: "DATASET",
  supplier: "Test Supplier",
  provider: "Test Provider",
  hostingModel: "SELF_HOSTED",
  networkDependency: "HYBRID",
});

const modelCardBody = {
  task: "classification",
  architectureFamily: "tree ensemble",
  intendedUsers: "test analysts",
  useCases: "test review",
  technicalLimitations: "test limitations",
  ethicalConsiderations: "test human oversight",
};

async function createAsset(overrides: Partial<Parameters<typeof prisma.aIAsset.create>[0]["data"]> = {}) {
  return prisma.aIAsset.create({
    data: {
      name: `${runId}-asset-${Math.random()}`,
      version: "1.0.0",
      type: "DATASET",
      supplier: "Test Supplier",
      provider: "Test Provider",
      hostingModel: "SELF_HOSTED",
      networkDependency: "HYBRID",
      createdById: userIds.get("ADMIN")!,
      ...overrides,
    },
  });
}

async function createProject() {
  return prisma.project.create({
    data: {
      name: `${runId}-project-${Math.random()}`,
      description: "Integration test project",
      businessOwner: "Test Owner",
      createdById: userIds.get("ADMIN")!,
    },
  });
}

async function createRisk(assetId?: string, overrides: Partial<Parameters<typeof prisma.risk.create>[0]["data"]> = {}) {
  return prisma.risk.create({
    data: {
      sourceFramework: "NIST_AI_RMF",
      sourceCategoryId: "GOVERN",
      description: `${runId}-risk-${Math.random()}`,
      likelihood: 2,
      impact: 2,
      inherentRiskScore: 4,
      status: "OPEN",
      createdById: userIds.get("ADMIN")!,
      ...(assetId ? { assets: { create: { assetId } } } : {}),
      ...overrides,
    },
  });
}

async function createControl() {
  return prisma.control.create({
    data: {
      name: `${runId}-control-${Math.random()}`,
      mappedFramework: "NIST_AI_RMF",
      mappedControlId: `${runId}-C-${Math.random()}`,
      description: "Integration test control",
    },
  });
}

async function expectMatrix(name: string, allowed: Role[], call: (role: Role) => Promise<request.Response>) {
  for (const role of roles) {
    const response = await call(role);
    if (allowed.includes(role)) {
      expect(response.status, `${name} should allow ${role}`).not.toBe(403);
      expect(response.status, `${name} should authenticate ${role}`).not.toBe(401);
    } else {
      expect(response.status, `${name} should deny ${role}`).toBe(403);
    }
  }
}

function auth(role: Role) {
  return { Authorization: `Bearer ${tokens.get(role)!}` };
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  await prisma.frameworkCategory.upsert({
    where: { framework_categoryId: { framework: "NIST_AI_RMF", categoryId: "GOVERN" } },
    update: { name: "Govern", description: "Test governance category" },
    create: { framework: "NIST_AI_RMF", categoryId: "GOVERN", name: "Govern", description: "Test governance category" },
  });

  for (const role of roles) {
    const user = await prisma.user.upsert({
      where: { email: `${runId}-${role.toLowerCase()}@example.com` },
      update: { role, passwordHash: await bcrypt.hash("password", 10) },
      create: { email: `${runId}-${role.toLowerCase()}@example.com`, name: `${role} Integration`, role, passwordHash: await bcrypt.hash("password", 10) },
    });
    userIds.set(role, user.id);
    tokens.set(role, signToken({ id: user.id, email: user.email, role: user.role }));
  }
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: [...userIds.values()] } } });
  await prisma.riskControl.deleteMany({ where: { risk: { description: { startsWith: runId } } } });
  await prisma.projectRisk.deleteMany({ where: { project: { name: { startsWith: runId } } } });
  await prisma.projectAsset.deleteMany({ where: { project: { name: { startsWith: runId } } } });
  await prisma.assetDependency.deleteMany({ where: { parentAsset: { name: { startsWith: runId } } } });
  await prisma.assetRisk.deleteMany({ where: { asset: { name: { startsWith: runId } } } });
  await prisma.recertificationSchedule.deleteMany({ where: { asset: { name: { startsWith: runId } } } });
  await prisma.modelCard.deleteMany({ where: { asset: { name: { startsWith: runId } } } });
  await prisma.risk.deleteMany({ where: { OR: [{ description: { startsWith: runId } }, { createdById: { in: [...userIds.values()] } }] } });
  await prisma.control.deleteMany({ where: { mappedControlId: { startsWith: runId } } });
  await prisma.project.deleteMany({ where: { name: { startsWith: runId } } });
  await prisma.aIAsset.deleteMany({ where: { name: { startsWith: runId } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: runId } } });
  await prisma.$disconnect();
});

describe("RBAC permission matrix", () => {
  it("enforces asset mutation roles", async () => {
    await expectMatrix("POST /assets", ["ADMIN", "RISK_OWNER"], (role) => request(app).post("/assets").set(auth(role)).send(assetBody(`${runId}-post-asset-${role}`)));

    await expectMatrix("PUT /assets/:id", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset({ createdById: role === "RISK_OWNER" ? userIds.get("RISK_OWNER")! : userIds.get("ADMIN")! });
      return request(app).put(`/assets/${asset.id}`).set(auth(role)).send(assetBody(`${runId}-put-asset-${role}`));
    });

    await expectMatrix("DELETE /assets/:id", ["ADMIN"], async (role) => {
      const asset = await createAsset();
      return request(app).delete(`/assets/${asset.id}`).set(auth(role));
    });
  });

  it("enforces relationship and recertification mutation roles", async () => {
    await expectMatrix("POST /assets/:assetId/risks/:riskId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset();
      const risk = await createRisk();
      return request(app).post(`/assets/${asset.id}/risks/${risk.id}`).set(auth(role));
    });

    await expectMatrix("DELETE /assets/:assetId/risks/:riskId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset();
      const risk = await createRisk(asset.id);
      return request(app).delete(`/assets/${asset.id}/risks/${risk.id}`).set(auth(role));
    });

    await expectMatrix("POST /assets/:parentAssetId/dependencies/:childAssetId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const parent = await createAsset({ type: "SERVICE" });
      const child = await createAsset({ type: "MODEL" });
      return request(app).post(`/assets/${parent.id}/dependencies/${child.id}`).set(auth(role));
    });

    await expectMatrix("DELETE /assets/:parentAssetId/dependencies/:childAssetId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const parent = await createAsset({ type: "SERVICE" });
      const child = await createAsset({ type: "MODEL" });
      await prisma.assetDependency.create({ data: { parentAssetId: parent.id, childAssetId: child.id } });
      return request(app).delete(`/assets/${parent.id}/dependencies/${child.id}`).set(auth(role));
    });

    await expectMatrix("POST /assets/:id/recertification", ["ADMIN", "APPROVER"], async (role) => {
      const asset = await createAsset({ type: "MODEL" });
      return request(app).post(`/assets/${asset.id}/recertification`).set(auth(role)).send({ cadenceDays: 30, nextDueDate: new Date().toISOString() });
    });
  });

  it("enforces project mutation roles", async () => {
    await expectMatrix("POST /projects", ["ADMIN", "RISK_OWNER"], (role) => request(app).post("/projects").set(auth(role)).send({ name: `${runId}-project-post-${role}` }));

    await expectMatrix("PUT /projects/:id", ["ADMIN", "RISK_OWNER"], async (role) => {
      const project = await createProject();
      return request(app).put(`/projects/${project.id}`).set(auth(role)).send({ name: `${runId}-project-put-${role}` });
    });

    await expectMatrix("DELETE /projects/:id", ["ADMIN"], async (role) => {
      const project = await createProject();
      return request(app).delete(`/projects/${project.id}`).set(auth(role));
    });

    await expectMatrix("POST /projects/:projectId/assets/:assetId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const project = await createProject();
      const asset = await createAsset();
      return request(app).post(`/projects/${project.id}/assets/${asset.id}`).set(auth(role));
    });

    await expectMatrix("DELETE /projects/:projectId/assets/:assetId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const project = await createProject();
      const asset = await createAsset();
      await prisma.projectAsset.create({ data: { projectId: project.id, assetId: asset.id } });
      return request(app).delete(`/projects/${project.id}/assets/${asset.id}`).set(auth(role));
    });

    await expectMatrix("POST /projects/:projectId/risks/:riskId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const project = await createProject();
      const risk = await createRisk();
      return request(app).post(`/projects/${project.id}/risks/${risk.id}`).set(auth(role));
    });

    await expectMatrix("DELETE /projects/:projectId/risks/:riskId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const project = await createProject();
      const risk = await createRisk();
      await prisma.projectRisk.create({ data: { projectId: project.id, riskId: risk.id } });
      return request(app).delete(`/projects/${project.id}/risks/${risk.id}`).set(auth(role));
    });
  });

  it("enforces risk, control, and model-card mutation roles", async () => {
    await expectMatrix("POST /risks", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset();
      return request(app).post("/risks").set(auth(role)).send({ assetId: asset.id, sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", description: `${runId}-risk-post-${role}`, likelihood: 2, impact: 3 });
    });

    await expectMatrix("PUT /risks/:id", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset();
      const risk = await createRisk(asset.id, { createdById: role === "RISK_OWNER" ? userIds.get("RISK_OWNER")! : userIds.get("ADMIN")! });
      return request(app).put(`/risks/${risk.id}`).set(auth(role)).send({ assetId: asset.id, sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", description: `${runId}-risk-put-${role}`, likelihood: 2, impact: 3 });
    });

    await expectMatrix("DELETE /risks/:id", ["ADMIN"], async (role) => {
      const risk = await createRisk();
      return request(app).delete(`/risks/${risk.id}`).set(auth(role));
    });

    await expectMatrix("POST /risks/:riskId/controls", ["ADMIN", "RISK_OWNER"], async (role) => {
      const risk = await createRisk();
      return request(app).post(`/risks/${risk.id}/controls`).set(auth(role)).send({ mappedFramework: "NIST_AI_RMF", mappedControlId: `${runId}-inline-${role}`, implementationStatus: "IMPLEMENTED" });
    });

    await expectMatrix("POST /risks/:riskId/controls/:controlId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const risk = await createRisk();
      const control = await createControl();
      return request(app).post(`/risks/${risk.id}/controls/${control.id}`).set(auth(role)).send({ implementationStatus: "IN_PROGRESS" });
    });

    await expectMatrix("PUT /risks/:riskId/controls/:controlId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const risk = await createRisk();
      const control = await createControl();
      await prisma.riskControl.create({ data: { riskId: risk.id, controlId: control.id } });
      return request(app).put(`/risks/${risk.id}/controls/${control.id}`).set(auth(role)).send({ implementationStatus: "VERIFIED" });
    });

    await expectMatrix("DELETE /risks/:riskId/controls/:controlId", ["ADMIN", "RISK_OWNER"], async (role) => {
      const risk = await createRisk();
      const control = await createControl();
      await prisma.riskControl.create({ data: { riskId: risk.id, controlId: control.id } });
      return request(app).delete(`/risks/${risk.id}/controls/${control.id}`).set(auth(role));
    });

    await expectMatrix("PUT /controls/:id", ["ADMIN", "RISK_OWNER"], async (role) => {
      const control = await createControl();
      return request(app).put(`/controls/${control.id}`).set(auth(role)).send({ mappedFramework: "NIST_AI_RMF", mappedControlId: `${runId}-updated-${role}` });
    });

    await expectMatrix("DELETE /controls/:id", ["ADMIN"], async (role) => {
      const control = await createControl();
      return request(app).delete(`/controls/${control.id}`).set(auth(role));
    });

    await expectMatrix("PUT /assets/:id/model-card", ["ADMIN", "RISK_OWNER"], async (role) => {
      const asset = await createAsset({ type: "MODEL" });
      return request(app).put(`/assets/${asset.id}/model-card`).set(auth(role)).send(modelCardBody);
    });
  });

  it("limits RISK_OWNER edits to owned assets and risks", async () => {
    const otherAsset = await createAsset({ createdById: userIds.get("ADMIN")! });
    const ownedAsset = await createAsset({ createdById: userIds.get("RISK_OWNER")! });
    const otherRisk = await createRisk(ownedAsset.id, { createdById: userIds.get("ADMIN")! });
    const ownedRisk = await createRisk(ownedAsset.id, { createdById: userIds.get("RISK_OWNER")! });

    await request(app).put(`/assets/${otherAsset.id}`).set(auth("RISK_OWNER")).send(assetBody(`${runId}-not-owned-asset`)).expect(403);
    await request(app).put(`/assets/${ownedAsset.id}`).set(auth("RISK_OWNER")).send(assetBody(`${runId}-owned-asset`)).expect(200);
    await request(app).put(`/risks/${otherRisk.id}`).set(auth("RISK_OWNER")).send({ assetId: ownedAsset.id, sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", description: `${runId}-not-owned-risk`, likelihood: 2, impact: 3 }).expect(403);
    await request(app).put(`/risks/${ownedRisk.id}`).set(auth("RISK_OWNER")).send({ assetId: ownedAsset.id, sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", description: `${runId}-owned-risk`, likelihood: 2, impact: 3 }).expect(200);
  });
});

describe("user management", () => {
  it("allows admins to create, update, deactivate, and reset users", async () => {
    await request(app).post("/users").set(auth("VIEWER")).send({ email: `${runId}-blocked@example.com`, name: "Blocked", role: "VIEWER", password: "password123" }).expect(403);

    const createResponse = await request(app)
      .post("/users")
      .set(auth("ADMIN"))
      .send({ email: `${runId}-managed@example.com`, name: "Managed User", role: "VIEWER", password: "password123" })
      .expect(201);
    const userId = createResponse.body.user.id;

    await request(app).get("/users").set(auth("ADMIN")).expect(200).expect((response) => {
      expect(response.body.users).toEqual(expect.arrayContaining([expect.objectContaining({ id: userId, role: "VIEWER", active: true })]));
    });

    await request(app)
      .put(`/users/${userId}`)
      .set(auth("ADMIN"))
      .send({ role: "APPROVER", active: false, password: "newpassword123" })
      .expect(200)
      .expect((response) => {
        expect(response.body.user).toMatchObject({ id: userId, role: "APPROVER", active: false });
      });

    const inactiveToken = signToken({ id: userId, email: `${runId}-managed@example.com`, role: "APPROVER" });
    await request(app).get("/auth/me").set({ Authorization: `Bearer ${inactiveToken}` }).expect(401);
  });
});

describe("asset transition policy gates", () => {
  it("blocks approval for open high risks, then allows approval after mitigation and complete model card", async () => {
    const asset = await createAsset({ type: "MODEL", status: "UNDER_REVIEW" });
    const risk = await createRisk(asset.id, { likelihood: 3, impact: 4, inherentRiskScore: 12, status: "OPEN" });
    await prisma.modelCard.create({ data: { assetId: asset.id, ...modelCardBody } });

    await request(app).post(`/assets/${asset.id}/transition`).set(auth("APPROVER")).send({ toStatus: "APPROVED" }).expect(400).expect((response) => {
      expect(response.body.error).toBe("Asset has open high or critical risks");
    });

    await prisma.risk.update({ where: { id: risk.id }, data: { status: "MITIGATED" } });
    await request(app).post(`/assets/${asset.id}/transition`).set(auth("APPROVER")).send({ toStatus: "APPROVED" }).expect(200);
  });

  it("blocks approval for missing model card fields, then allows approval once completed", async () => {
    const asset = await createAsset({ type: "SERVICE", status: "UNDER_REVIEW" });
    await prisma.modelCard.create({ data: { assetId: asset.id, task: "generation" } });

    await request(app).post(`/assets/${asset.id}/transition`).set(auth("APPROVER")).send({ toStatus: "APPROVED" }).expect(400).expect((response) => {
      expect(response.body.error).toBe("Model card incomplete");
      expect(response.body.missingFields).toContain("architecture");
    });

    await prisma.modelCard.update({ where: { assetId: asset.id }, data: modelCardBody });
    await request(app).post(`/assets/${asset.id}/transition`).set(auth("APPROVER")).send({ toStatus: "APPROVED" }).expect(200);
  });
});

describe("segregation of duties", () => {
  it("blocks approving an asset moved to review by the same user", async () => {
    const asset = await createAsset({ type: "MODEL", status: "DRAFT" });
    await prisma.modelCard.create({ data: { assetId: asset.id, ...modelCardBody } });

    await request(app).post(`/assets/${asset.id}/transition`).set(auth("ADMIN")).send({ toStatus: "UNDER_REVIEW" }).expect(200);
    await request(app).post(`/assets/${asset.id}/transition`).set(auth("ADMIN")).send({ toStatus: "APPROVED" }).expect(403).expect((response) => {
      expect(response.body.error).toMatch(/Segregation of duties/);
    });
    await request(app).post(`/assets/${asset.id}/transition`).set(auth("APPROVER")).send({ toStatus: "APPROVED" }).expect(200);
  });

  it("blocks accepting a risk created by the same user", async () => {
    const asset = await createAsset({ createdById: userIds.get("RISK_OWNER")! });
    const risk = await createRisk(asset.id, { createdById: userIds.get("RISK_OWNER")! });
    const payload = { assetId: asset.id, sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", description: `${runId}-sod-risk`, likelihood: 2, impact: 3, status: "ACCEPTED" };

    await request(app).put(`/risks/${risk.id}`).set(auth("RISK_OWNER")).send(payload).expect(403).expect((response) => {
      expect(response.body.error).toMatch(/Segregation of duties/);
    });
    await request(app).put(`/risks/${risk.id}`).set(auth("ADMIN")).send(payload).expect(200);
  });
});

describe("Model Card metric CRUD", () => {
  it("creates, returns, updates, audits, and deletes metric rows", async () => {
    const asset = await createAsset({ type: "MODEL" });
    await prisma.modelCard.create({ data: { assetId: asset.id, ...modelCardBody } });

    const createResponse = await request(app)
      .post(`/assets/${asset.id}/model-card/metrics`)
      .set(auth("RISK_OWNER"))
      .send({ metricName: "accuracy", metricValue: 0.91, slice: "overall" })
      .expect(201);
    const metricId = createResponse.body.metric.id;

    await request(app).get(`/assets/${asset.id}/model-card`).set(auth("VIEWER")).expect(200).expect((response) => {
      expect(response.body.modelCard.metrics).toEqual(expect.arrayContaining([expect.objectContaining({ id: metricId, metricName: "accuracy", metricValue: 0.91 })]));
    });

    await request(app)
      .put(`/assets/${asset.id}/model-card/metrics/${metricId}`)
      .set(auth("ADMIN"))
      .send({ metricName: "accuracy", metricValue: 0.94, slice: "overall" })
      .expect(200)
      .expect((response) => {
        expect(response.body.metric).toMatchObject({ id: metricId, metricName: "accuracy", metricValue: 0.94 });
      });

    await request(app).delete(`/assets/${asset.id}/model-card/metrics/${metricId}`).set(auth("ADMIN")).expect(204);
    expect(await prisma.modelCardMetric.findUnique({ where: { id: metricId } })).toBeNull();
    await expect(prisma.auditLog.findMany({ where: { entityType: "ModelCardMetric", entityId: metricId } })).resolves.toHaveLength(3);
  });
});

describe("URL import", () => {
  it("rejects loopback and cloud metadata URLs before fetching", async () => {
    await request(app)
      .post("/assets/import-url")
      .set(auth("ADMIN"))
      .send({ sourceUrl: "http://127.0.0.1/internal" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toMatch(/blocked private, loopback, or link-local/);
      });

    await request(app)
      .post("/assets/import-url")
      .set(auth("ADMIN"))
      .send({ sourceUrl: "http://169.254.169.254/latest/meta-data" })
      .expect(400)
      .expect((response) => {
        expect(response.body.error).toMatch(/blocked private, loopback, or link-local/);
      });
  });
});

describe("archive-not-delete semantics", () => {
  it("archives linked risks and hard-deletes unlinked risks", async () => {
    const asset = await createAsset();
    const linkedRisk = await createRisk(asset.id);
    const unlinkedRisk = await createRisk();

    await request(app).delete(`/risks/${linkedRisk.id}`).set(auth("ADMIN")).expect(204);
    await request(app).delete(`/risks/${unlinkedRisk.id}`).set(auth("ADMIN")).expect(204);

    expect(await prisma.risk.findUnique({ where: { id: linkedRisk.id } })).toMatchObject({ archived: true });
    expect(await prisma.risk.findUnique({ where: { id: unlinkedRisk.id } })).toBeNull();
  });

  it("archives linked controls and hard-deletes unlinked controls", async () => {
    const risk = await createRisk();
    const linkedControl = await createControl();
    const unlinkedControl = await createControl();
    await prisma.riskControl.create({ data: { riskId: risk.id, controlId: linkedControl.id } });

    await request(app).delete(`/controls/${linkedControl.id}`).set(auth("ADMIN")).expect(204);
    await request(app).delete(`/controls/${unlinkedControl.id}`).set(auth("ADMIN")).expect(204);

    expect(await prisma.control.findUnique({ where: { id: linkedControl.id } })).toMatchObject({ archived: true });
    expect(await prisma.control.findUnique({ where: { id: unlinkedControl.id } })).toBeNull();
  });
});

describe("CSV exports", () => {
  it("exports filtered assets and risks as CSV", async () => {
    const asset = await createAsset({ status: "DEPLOYED", type: "MODEL" });
    await createRisk(asset.id, { status: "OPEN", sourceFramework: "NIST_AI_RMF", description: "=HYPERLINK(\"https://example.com\")" });

    await request(app).get("/assets/export/csv?status=DEPLOYED&type=MODEL").set(auth("VIEWER")).expect(200).expect((response) => {
      expect(response.header["content-type"]).toContain("text/csv");
      expect(response.text).toContain("id,name,version,type");
      expect(response.text).toContain(asset.id);
    });

    await request(app).get(`/risks/export/csv?assetId=${asset.id}&sourceFramework=NIST_AI_RMF`).set(auth("VIEWER")).expect(200).expect((response) => {
      expect(response.header["content-type"]).toContain("text/csv");
      expect(response.text).toContain("description,severity");
      expect(response.text).toContain(asset.name);
      expect(response.text).toContain("'=");
    });
  });
});

describe("export fixtures", () => {
  it("validates a CycloneDX fixture with risks, controls, and Model Card", async () => {
    const asset = await createAsset({ type: "MODEL", sourceUrl: "https://example.com/model-card" });
    const risk = await createRisk(asset.id);
    const control = await createControl();
    await prisma.riskControl.create({ data: { riskId: risk.id, controlId: control.id, implementationStatus: "VERIFIED" } });
    await prisma.modelCard.create({ data: { assetId: asset.id, ...modelCardBody, performanceMetrics: [{ type: "accuracy", value: 0.92, slice: "overall" }] } });
    const fixture = await prisma.aIAsset.findUniqueOrThrow({ where: { id: asset.id }, include: { modelCard: true, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } });

    const bom = buildCycloneDxBom([{ ...fixture, risks: fixture.riskLinks.map((link) => ({ ...link.risk, controls: link.risk.controlLinks.map((controlLink) => ({ ...controlLink.control, implementationStatus: controlLink.implementationStatus, evidenceNotes: controlLink.evidenceNotes })) })) }]);
    expect(bom.components?.[0].externalReferences).toContainEqual({ type: "website", url: "https://example.com/model-card" });
    await expect(validateCycloneDxBom(bom)).resolves.toMatchObject({ valid: true });
  });

  it("includes SPDX DESCRIBES relationships for exported assets", async () => {
    const asset = await createAsset();
    const document = buildSpdxDocument([asset]);

    expect(document.relationships).toContainEqual({
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: `SPDXRef-AIAsset-${asset.id}`,
    });
  });
});

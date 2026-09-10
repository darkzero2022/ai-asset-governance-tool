import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const admin = { email: "tm-admin@example.com", password: "a-perfectly-fine-passphrase" };
const viewer = { email: "tm-viewer@example.com", password: "a-perfectly-fine-passphrase" };
const FETCH = { "X-Requested-With": "fetch" };

let adminAuth: Record<string, string>;
let viewerAuth: Record<string, string>;
let assetId = "";
const cleanupRiskIds: string[] = [];

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  for (const [u, role] of [
    [admin, "ADMIN"],
    [viewer, "VIEWER"],
  ] as const) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash: await bcrypt.hash(u.password, 10), role, active: true },
      create: { email: u.email, name: role, role, passwordHash: await bcrypt.hash(u.password, 10) },
    });
  }
  const login = async (u: typeof admin) =>
    (await request(app).post("/api/v1/auth/login").set(FETCH).send(u)).body.accessToken as string;
  adminAuth = { Authorization: `Bearer ${await login(admin)}` };
  viewerAuth = { Authorization: `Bearer ${await login(viewer)}` };

  // Framework categories the rules reference.
  for (const [framework, categoryId] of [
    ["OWASP_LLM_TOP10", "LLM01"],
    ["OWASP_LLM_TOP10", "LLM04"],
  ] as const) {
    await prisma.frameworkCategory.upsert({
      where: { framework_categoryId: { framework, categoryId } },
      update: {},
      create: { framework, categoryId, name: categoryId, description: "x" },
    });
  }

  const creator = await prisma.user.findUniqueOrThrow({ where: { email: admin.email } });
  const asset = await prisma.aIAsset.create({
    data: {
      name: `TM fixture ${Date.now()}`,
      version: "1.0.0",
      type: "MODEL",
      supplier: "x",
      hostingModel: "SELF_HOSTED",
      createdById: creator.id,
    },
  });
  assetId = asset.id;
});

afterAll(async () => {
  await prisma.threatModel.deleteMany({ where: { assetId } });
  await prisma.risk.deleteMany({ where: { id: { in: cleanupRiskIds } } });
  await prisma.aIAsset.deleteMany({ where: { id: assetId } });
  await prisma.auditLog.deleteMany({
    where: { actor: { email: { in: [admin.email, viewer.email] } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: [admin.email, viewer.email] } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [admin.email, viewer.email] } } });
  await prisma.$disconnect();
});

describe("threat modelling", () => {
  it("builds a model, suggests threats from the rules, and promotes one to a risk", async () => {
    // VIEWER cannot create
    await request(app)
      .post(`/api/v1/ai-systems/${assetId}/threat-model`)
      .set(viewerAuth)
      .send({ title: "no" })
      .expect(403);

    const created = await request(app)
      .post(`/api/v1/ai-systems/${assetId}/threat-model`)
      .set(adminAuth)
      .send({ title: "Inference path", description: "MVP model + user + training data" })
      .expect(201);
    const modelId = created.body.threatModel.id as string;

    // one per asset
    await request(app)
      .post(`/api/v1/ai-systems/${assetId}/threat-model`)
      .set(adminAuth)
      .send({ title: "dup" })
      .expect(409);

    const addElement = async (type: string, name: string) =>
      (
        await request(app)
          .post(`/api/v1/threat-models/${modelId}/elements`)
          .set(adminAuth)
          .send({ type, name })
          .expect(201)
      ).body.threatModel.elements.find((e: { name: string }) => e.name === name) as { id: string };

    const user = await addElement("END_USER", "Analyst");
    const model = await addElement("MODEL", "Claims LLM");
    const dataset = await addElement("TRAINING_DATASET", "Historical claims");

    const flow = async (sourceId: string, targetId: string, label: string) =>
      request(app)
        .post(`/api/v1/threat-models/${modelId}/flows`)
        .set(adminAuth)
        .send({ sourceId, targetId, label })
        .expect(201);
    await flow(user.id, model.id, "prompt");
    await flow(dataset.id, model.id, "fine-tune corpus");

    // a flow needs two distinct, in-model elements
    await request(app)
      .post(`/api/v1/threat-models/${modelId}/flows`)
      .set(adminAuth)
      .send({ sourceId: model.id, targetId: model.id, label: "loop" })
      .expect(400);

    const suggested = await request(app)
      .post(`/api/v1/threat-models/${modelId}/suggest`)
      .set(adminAuth)
      .expect(200);
    const rules = suggested.body.threatModel.threats.map((t: { ruleId: string }) => t.ruleId);
    expect(rules).toContain("prompt-injection");
    expect(rules).toContain("training-data-poisoning");

    // re-running suggest does not duplicate
    const again = await request(app)
      .post(`/api/v1/threat-models/${modelId}/suggest`)
      .set(adminAuth)
      .expect(200);
    expect(again.body.added).toBe(0);

    const promptThreat = suggested.body.threatModel.threats.find(
      (t: { ruleId: string }) => t.ruleId === "prompt-injection",
    );

    // accept it
    await request(app)
      .put(`/api/v1/threat-models/${modelId}/threats/${promptThreat.id}`)
      .set(adminAuth)
      .send({ status: "ACCEPTED" })
      .expect(200);

    // promote -> a draft Risk on the asset
    const promoted = await request(app)
      .post(`/api/v1/threat-models/${modelId}/threats/${promptThreat.id}/promote`)
      .set(adminAuth)
      .send({ likelihood: 3, impact: 4 })
      .expect(201);
    cleanupRiskIds.push(promoted.body.riskId);
    const risk = await prisma.risk.findUniqueOrThrow({ where: { id: promoted.body.riskId } });
    expect(risk.sourceCategoryId).toBe("LLM01");
    expect(risk.strideAiCategory).toBe("ALIGNMENT_BYPASS");
    expect(risk.inherentRiskScore).toBe(12);

    // cannot promote twice
    await request(app)
      .post(`/api/v1/threat-models/${modelId}/threats/${promptThreat.id}/promote`)
      .set(adminAuth)
      .expect(409);

    // report has a laid-out diagram
    const report = await request(app)
      .get(`/api/v1/threat-models/${modelId}/report`)
      .set(viewerAuth)
      .expect(200);
    expect(report.body.report.diagram.nodes).toHaveLength(3);
    expect(report.body.report.diagram.edges).toHaveLength(2);
    expect(report.body.report.summary.promoted).toBe(1);
    // END_USER is column 0, MODEL is column 3 — user sits left of the model
    const nodes = report.body.report.diagram.nodes as { name: string; x: number }[];
    expect(nodes.find((n) => n.name === "Analyst")!.x).toBeLessThan(
      nodes.find((n) => n.name === "Claims LLM")!.x,
    );
  });
});

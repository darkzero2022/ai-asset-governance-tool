import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./prisma.js";

const admin = { email: "attach-admin@example.com", password: "a-perfectly-fine-passphrase" };
const viewer = { email: "attach-viewer@example.com", password: "a-perfectly-fine-passphrase" };
const FETCH = { "X-Requested-With": "fetch" };

let adminToken = "";
let viewerToken = "";
let riskId = "";

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
  adminToken = (await request(app).post("/api/v1/auth/login").set(FETCH).send(admin)).body
    .accessToken;
  viewerToken = (await request(app).post("/api/v1/auth/login").set(FETCH).send(viewer)).body
    .accessToken;

  await prisma.frameworkCategory.upsert({
    where: { framework_categoryId: { framework: "NIST_AI_RMF", categoryId: "GOVERN" } },
    update: {},
    create: { framework: "NIST_AI_RMF", categoryId: "GOVERN", name: "Govern", description: "x" },
  });
  const creator = await prisma.user.findUniqueOrThrow({ where: { email: admin.email } });
  const risk = await prisma.risk.create({
    data: {
      description: "Attachment fixture risk",
      sourceFramework: "NIST_AI_RMF",
      sourceCategoryId: "GOVERN",
      likelihood: 3,
      impact: 3,
      inherentRiskScore: 9,
      createdById: creator.id,
    },
  });
  riskId = risk.id;
});

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { entityId: riskId } });
  await prisma.risk.deleteMany({ where: { id: riskId } });
  await prisma.auditLog.deleteMany({
    where: { actor: { email: { in: [admin.email, viewer.email] } } },
  });
  await prisma.session.deleteMany({
    where: { user: { email: { in: [admin.email, viewer.email] } } },
  });
  await prisma.user.deleteMany({ where: { email: { in: [admin.email, viewer.email] } } });
  await prisma.$disconnect();
});

describe("evidence attachments", () => {
  it("uploads, lists, downloads, and deletes", async () => {
    const upload = await request(app)
      .post("/api/v1/attachments")
      .set({ Authorization: `Bearer ${adminToken}` })
      .field("entityType", "RISK")
      .field("entityId", riskId)
      .field("description", "signed DPA")
      .attach("file", Buffer.from("evidence body"), {
        filename: "dpa.pdf",
        contentType: "application/pdf",
      })
      .expect(201);
    expect(upload.body.attachment).toMatchObject({
      filename: "dpa.pdf",
      contentType: "application/pdf",
      entityType: "RISK",
      description: "signed DPA",
    });
    const id = upload.body.attachment.id as string;

    const list = await request(app)
      .get(`/api/v1/attachments?entityType=RISK&entityId=${riskId}`)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .expect(200);
    expect(list.body.attachments).toHaveLength(1);

    const download = await request(app)
      .get(`/api/v1/attachments/${id}/download`)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-disposition"]).toContain("dpa.pdf");
    expect((download.body as Buffer).toString("utf8")).toBe("evidence body");

    // a VIEWER cannot upload
    await request(app)
      .post("/api/v1/attachments")
      .set({ Authorization: `Bearer ${viewerToken}` })
      .field("entityType", "RISK")
      .field("entityId", riskId)
      .attach("file", Buffer.from("x"), { filename: "x.pdf", contentType: "application/pdf" })
      .expect(403);

    // a VIEWER cannot delete someone else's attachment
    await request(app)
      .delete(`/api/v1/attachments/${id}`)
      .set({ Authorization: `Bearer ${viewerToken}` })
      .expect(403);

    await request(app)
      .delete(`/api/v1/attachments/${id}`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(204);
    await request(app)
      .get(`/api/v1/attachments/${id}/download`)
      .set({ Authorization: `Bearer ${adminToken}` })
      .expect(404);
  });

  it("rejects an unsupported content type", async () => {
    await request(app)
      .post("/api/v1/attachments")
      .set({ Authorization: `Bearer ${adminToken}` })
      .field("entityType", "RISK")
      .field("entityId", riskId)
      .attach("file", Buffer.from("MZ..."), {
        filename: "tool.exe",
        contentType: "application/x-msdownload",
      })
      .expect(422);
  });

  it("404s when the target entity does not exist", async () => {
    await request(app)
      .post("/api/v1/attachments")
      .set({ Authorization: `Bearer ${adminToken}` })
      .field("entityType", "RISK")
      .field("entityId", "does-not-exist")
      .attach("file", Buffer.from("x"), { filename: "x.pdf", contentType: "application/pdf" })
      .expect(404);
  });
});

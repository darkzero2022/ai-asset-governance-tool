import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import { Issuer, generators, type Client } from "openid-client";
import { z } from "zod";
import { AssetStatus, Prisma } from "@prisma/client";
import { requireAuth, signToken } from "./auth.js";
import { buildCycloneDxBom, validateCycloneDxBom } from "./cyclonedx.js";
import { prisma } from "./prisma.js";
import { canTransitionAsset, requireRole } from "./rbac.js";
import { HIGH_SEVERITY_MIN_SCORE, severityOf } from "./riskScoring.js";
import { buildSpdxDocument } from "./spdx.js";
import { sendSlackRiskStatusChange } from "./integrations/slack.js";
import { modelCardCompleteness } from "./modelCardScoring.js";

const assetSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  type: z.enum(["MODEL", "DATASET", "SERVICE", "LIBRARY"]),
  supplier: z.string().min(1),
  provider: z.string().optional().nullable(),
  hostingModel: z.enum(["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"]),
  networkDependency: z.enum(["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"]).optional(),
  license: z.string().optional().nullable(),
  dataClassificationTouched: z.string().optional().nullable(),
  trainingDataProvenance: z.string().optional().nullable(),
  downstreamConsumers: z.string().optional().nullable(),
});

const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  businessOwner: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
});

const modelCardSchema = z.object({
  approach: z.string().optional().nullable(),
  task: z.string().optional().nullable(),
  architectureFamily: z.string().optional().nullable(),
  modelArchitecture: z.string().optional().nullable(),
  datasetsDescription: z.string().optional().nullable(),
  inputsDescription: z.string().optional().nullable(),
  outputsDescription: z.string().optional().nullable(),
  intendedUsers: z.string().optional().nullable(),
  useCases: z.string().optional().nullable(),
  technicalLimitations: z.string().optional().nullable(),
  performanceTradeoffs: z.string().optional().nullable(),
  ethicalConsiderations: z.string().optional().nullable(),
  fairnessAssessments: z.string().optional().nullable(),
  environmentalConsiderations: z.string().optional().nullable(),
  performanceMetrics: z.unknown().optional().nullable(),
});

const modelCardMetricSchema = z.object({
  metricName: z.string().min(1),
  metricValue: z.number(),
  slice: z.string().optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

const riskSchema = z.object({
  assetId: z.string().min(1),
  sourceFramework: z.enum(["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]),
  sourceCategoryId: z.string().min(1),
  euAiActRiskTier: z.enum(["UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"]).optional().nullable(),
  description: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualRiskScore: z.number().int().min(1).max(25).optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]).optional(),
});

const controlSchema = z.object({
  mappedFramework: z.enum(["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]),
  mappedControlId: z.string().min(1),
  implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(),
  evidenceNotes: z.string().optional().nullable(),
});

const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"]),
  password: z.string().min(8),
});

const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const allowedTransitions: Record<AssetStatus, AssetStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["DEPLOYED", "UNDER_REVIEW"],
  DEPLOYED: ["RETIRED"],
  RETIRED: [],
};

function requiredRoleForTransition(toStatus: AssetStatus) {
  if (toStatus === "UNDER_REVIEW" || toStatus === "DRAFT") return "RISK_OWNER";
  if (toStatus === "APPROVED" || toStatus === "DEPLOYED" || toStatus === "RETIRED") return "APPROVER";
  return null;
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

function pagination(query: express.Request["query"]) {
  const skip = Math.max(Number(query.skip ?? 0) || 0, 0);
  const requestedTake = Math.max(Number(query.take ?? 50) || 50, 1);
  return { skip, take: Math.min(requestedTake, 100) };
}

async function audit(actorId: string, entityType: string, entityId: string, action: string, beforeJson: unknown, afterJson: unknown) {
  await prisma.auditLog.create({
    data: {
      actorId,
      entityType,
      entityId,
      action,
      beforeJson: beforeJson === undefined ? Prisma.JsonNull : beforeJson as Prisma.InputJsonValue,
      afterJson: afterJson === undefined ? Prisma.JsonNull : afterJson as Prisma.InputJsonValue,
    },
  });
}

function riskResponse<T extends { assets?: Array<{ asset: unknown }> }>(risk: T) {
  const controlLinks = (risk as T & { controlLinks?: Array<{ control: object; implementationStatus: string; evidenceNotes: string | null }> }).controlLinks ?? [];
  const assetLinks = (risk as T & { assets?: Array<{ assetId?: string; asset: unknown }> }).assets ?? [];
  const inherentRiskScore = (risk as T & { inherentRiskScore?: number }).inherentRiskScore;
  return {
    ...risk,
    severity: typeof inherentRiskScore === "number" ? severityOf(inherentRiskScore) : undefined,
    assetId: assetLinks[0]?.assetId ?? "",
    asset: assetLinks[0]?.asset ?? null,
    controls: controlLinks.map((link) => ({ ...link.control, implementationStatus: link.implementationStatus, evidenceNotes: link.evidenceNotes })),
  };
}

function assetResponse<T extends { riskLinks?: Array<{ risk: unknown }> }>(asset: T) {
  return { ...asset, risks: asset.riskLinks?.map((link) => link.risk) ?? [] };
}

function assetListResponse<T extends { _count?: { riskLinks?: number; projectLinks?: number } }>(asset: T) {
  return { ...asset, _count: { risks: asset._count?.riskLinks ?? 0 }, projectUsageCount: asset._count?.projectLinks ?? 0 };
}

function assetForBom<T extends { riskLinks?: Array<{ risk: unknown }> }>(asset: T) {
  return { ...asset, risks: asset.riskLinks?.map((link) => riskResponse(link.risk as never)) ?? [] };
}

function modelCardResponse<T extends object | null>(card: T) {
  return card ? { ...card, completeness: modelCardCompleteness(card) } : null;
}

function modelCardData(body: z.infer<typeof modelCardSchema>) {
  const { performanceMetrics, ...data } = body;
  return {
    ...data,
    ...(performanceMetrics === undefined ? {} : { performanceMetrics: performanceMetrics === null ? Prisma.JsonNull : performanceMetrics as Prisma.InputJsonValue }),
  };
}

async function countRiskSeverityBuckets(where: Prisma.RiskWhereInput = {}) {
  const severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
  const scores = Array.from({ length: 25 }, (_, index) => index + 1);
  const entries = await Promise.all(severities.map(async (severity) => {
    const matchingScores = scores.filter((score) => severityOf(score) === severity);
    const count = await prisma.risk.count({ where: { ...where, inherentRiskScore: { in: matchingScores } } });
    return [severity, count] as const;
  }));

  return Object.fromEntries(entries);
}

type OidcState = {
  nonce: string;
  codeVerifier: string;
  expiresAt: number;
};

const oidcStates = new Map<string, OidcState>();
let oidcClientPromise: Promise<Client> | undefined;

function oidcConfigured() {
  return Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_REDIRECT_URI);
}

async function oidcClient() {
  if (!oidcConfigured()) throw new Error("OIDC is not configured");
  oidcClientPromise ??= Issuer.discover(process.env.OIDC_ISSUER_URL!).then((issuer) => new issuer.Client({
    client_id: process.env.OIDC_CLIENT_ID!,
    client_secret: process.env.OIDC_CLIENT_SECRET!,
    redirect_uris: [process.env.OIDC_REDIRECT_URI!],
    response_types: ["code"],
  }));
  return oidcClientPromise;
}

function cleanExpiredOidcStates() {
  const now = Date.now();
  for (const [state, value] of oidcStates.entries()) {
    if (value.expiresAt <= now) oidcStates.delete(state);
  }
}

export const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:5173,http://127.0.0.1:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/login", loginRateLimit, async (req, res, next) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });

    if (!user || !user.active || !(await bcrypt.compare(body.password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    res.json({ token: signToken({ id: user.id, email: user.email, role: user.role }), user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, name: true, role: true, active: true } });
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get("/auth/oidc/login", async (_req, res, next) => {
  try {
    if (!oidcConfigured()) {
      res.status(501).json({ error: "OIDC is not configured" });
      return;
    }

    cleanExpiredOidcStates();
    const client = await oidcClient();
    const state = generators.state();
    const nonce = generators.nonce();
    const codeVerifier = generators.codeVerifier();
    oidcStates.set(state, { nonce, codeVerifier, expiresAt: Date.now() + 10 * 60 * 1000 });

    res.redirect(client.authorizationUrl({
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: generators.codeChallenge(codeVerifier),
      code_challenge_method: "S256",
    }));
  } catch (error) {
    next(error);
  }
});

app.get("/auth/oidc/callback", async (req, res, next) => {
  try {
    if (!oidcConfigured()) {
      res.status(501).json({ error: "OIDC is not configured" });
      return;
    }

    cleanExpiredOidcStates();
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const storedState = oidcStates.get(state);

    if (!storedState) {
      res.status(400).json({ error: "Invalid or expired OIDC state" });
      return;
    }

    oidcStates.delete(state);
    const client = await oidcClient();
    const params = client.callbackParams(req);
    const tokenSet = await client.callback(process.env.OIDC_REDIRECT_URI!, params, { state, nonce: storedState.nonce, code_verifier: storedState.codeVerifier });
    const claims = tokenSet.claims();
    const email = claims.email;

    if (!email) {
      res.status(400).json({ error: "OIDC provider did not return an email claim" });
      return;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: claims.name ?? email, active: true },
      create: { email, name: claims.name ?? email, role: "VIEWER", active: true, passwordHash: await bcrypt.hash(generators.random(32), 10) },
    });
    const token = signToken({ id: user.id, email: user.email, role: user.role });
    const redirectUrl = process.env.OIDC_POST_LOGIN_REDIRECT_URL;

    if (redirectUrl) {
      const url = new URL(redirectUrl);
      url.searchParams.set("token", token);
      res.redirect(url.toString());
      return;
    }

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});

app.get("/users", requireAuth, requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: "desc" } });
    res.json({ users });
  } catch (error) {
    next(error);
  }
});

app.post("/users", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const body = userCreateSchema.parse(req.body);
    const user = await prisma.user.create({
      data: { email: body.email, name: body.name, role: body.role, passwordHash: await bcrypt.hash(body.password, 10) },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    await audit(req.user!.id, "User", user.id, "CREATE", undefined, user);
    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
});

app.put("/users/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = userUpdateSchema.parse(req.body);
    const before = await prisma.user.findUniqueOrThrow({ where: { id }, select: { id: true, email: true, name: true, role: true, active: true, createdAt: true } });
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.password !== undefined ? { passwordHash: await bcrypt.hash(body.password, 10) } : {}),
      },
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
    });
    await audit(req.user!.id, "User", id, "UPDATE", before, user);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

app.get("/reference/framework-categories", requireAuth, async (req, res, next) => {
  try {
    const framework = req.query.framework as string | undefined;
    const categories = await prisma.frameworkCategory.findMany({
      where: framework ? { framework: framework as never } : undefined,
      orderBy: [{ framework: "asc" }, { categoryId: "asc" }],
    });
    res.json({ categories });
  } catch (error) {
    next(error);
  }
});

app.get("/reference/eu-ai-act-risk-tiers", requireAuth, async (_req, res, next) => {
  try {
    const tiers = await prisma.euAiActRiskTierReference.findMany({ orderBy: { name: "asc" } });
    res.json({ tiers });
  } catch (error) {
    next(error);
  }
});

app.get("/assets", requireAuth, async (req, res, next) => {
  try {
    const { status, type, hostingModel, networkDependency } = req.query;
    const page = pagination(req.query);
    const where = {
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(hostingModel ? { hostingModel: hostingModel as never } : {}),
      ...(networkDependency ? { networkDependency: networkDependency as never } : {}),
    };
    const total = await prisma.aIAsset.count({ where });
    const assets = await prisma.aIAsset.findMany({
      where,
      include: { createdBy: { select: { id: true, name: true, email: true } }, _count: { select: { riskLinks: true, projectLinks: true } } },
      orderBy: { updatedAt: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ assets: assets.map(assetListResponse), pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

app.post("/assets", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const body = assetSchema.parse(req.body);
    const asset = await prisma.aIAsset.create({ data: { ...body, createdById: req.user!.id } });
    await audit(req.user!.id, "AIAsset", asset.id, "CREATE", undefined, asset);
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({
      where: { id },
      include: {
        riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } }, frameworkCategory: true } } }, orderBy: { linkedAt: "desc" } },
        projectLinks: { include: { project: true } },
        parentDependencies: { include: { childAsset: true } },
        childDependencies: { include: { parentAsset: true } },
        _count: { select: { projectLinks: true } },
        workflow: { include: { approvedBy: { select: { id: true, name: true, email: true } } }, orderBy: { timestamp: "desc" } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    res.json({ asset: { ...assetResponse(asset), projectUsageCount: asset._count.projectLinks } });
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id/model-card", requireAuth, async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    const modelCard = await prisma.modelCard.findUnique({ where: { assetId }, include: { metrics: { orderBy: { recordedAt: "desc" } } } });
    res.json({ modelCard: modelCardResponse(modelCard), completeness: modelCardCompleteness(modelCard) });
  } catch (error) {
    next(error);
  }
});

app.put("/assets/:id/model-card", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const body = modelCardSchema.parse(req.body);
    const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    const before = await prisma.modelCard.findUnique({ where: { assetId } });
    const data = modelCardData(body);
    const modelCard = await prisma.modelCard.upsert({
      where: { assetId },
      update: data,
      create: { assetId, ...data },
    });
    await audit(req.user!.id, "ModelCard", modelCard.id, before ? "UPDATE" : "CREATE", before, modelCard);
    res.json({ modelCard: modelCardResponse(modelCard) });
  } catch (error) {
    next(error);
  }
});

app.post("/assets/:id/model-card/metrics", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const body = modelCardMetricSchema.parse(req.body);
    const asset = await prisma.aIAsset.findUnique({ where: { id: assetId }, select: { id: true } });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    const modelCard = await prisma.modelCard.upsert({ where: { assetId }, update: {}, create: { assetId } });
    const metric = await prisma.modelCardMetric.create({
      data: {
        modelCardId: modelCard.id,
        metricName: body.metricName,
        metricValue: body.metricValue,
        slice: body.slice,
        recordedAt: body.recordedAt ? new Date(body.recordedAt) : undefined,
      },
    });
    await audit(req.user!.id, "ModelCardMetric", metric.id, "CREATE", undefined, metric);
    res.status(201).json({ metric });
  } catch (error) {
    next(error);
  }
});

app.put("/assets/:id/model-card/metrics/:metricId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const metricId = String(req.params.metricId);
    const body = modelCardMetricSchema.parse(req.body);
    const before = await prisma.modelCardMetric.findFirstOrThrow({ where: { id: metricId, modelCard: { assetId } } });
    const metric = await prisma.modelCardMetric.update({
      where: { id: metricId },
      data: {
        metricName: body.metricName,
        metricValue: body.metricValue,
        slice: body.slice,
        ...(body.recordedAt ? { recordedAt: new Date(body.recordedAt) } : {}),
      },
    });
    await audit(req.user!.id, "ModelCardMetric", metric.id, "UPDATE", before, metric);
    res.json({ metric });
  } catch (error) {
    next(error);
  }
});

app.delete("/assets/:id/model-card/metrics/:metricId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const metricId = String(req.params.metricId);
    const before = await prisma.modelCardMetric.findFirstOrThrow({ where: { id: metricId, modelCard: { assetId } } });
    await prisma.modelCardMetric.delete({ where: { id: metricId } });
    await audit(req.user!.id, "ModelCardMetric", metricId, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.put("/assets/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = assetSchema.parse(req.body);
    const before = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });

    if (req.user!.role === "RISK_OWNER" && before.createdById !== req.user!.id) {
      res.status(403).json({ error: "RISK_OWNER can only edit assets they created" });
      return;
    }

    const asset = await prisma.aIAsset.update({ where: { id }, data: body });
    await audit(req.user!.id, "AIAsset", asset.id, "UPDATE", before, asset);
    res.json({ asset });
  } catch (error) {
    next(error);
  }
});

app.delete("/assets/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });
    await prisma.aIAsset.delete({ where: { id } });
    await audit(req.user!.id, "AIAsset", id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/assets/:id/transition", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = z.object({ toStatus: z.nativeEnum(AssetStatus), comments: z.string().optional().nullable() }).parse(req.body);
    const asset = await prisma.aIAsset.findUniqueOrThrow({ where: { id } });

    if (!allowedTransitions[asset.status].includes(body.toStatus)) {
      res.status(400).json({ error: `Invalid transition from ${asset.status} to ${body.toStatus}` });
      return;
    }

    if (!canTransitionAsset(req.user!.role, body.toStatus)) {
      res.status(403).json({ error: "Insufficient permissions for asset transition" });
      return;
    }

    if (body.toStatus === "APPROVED") {
      const underReviewStep = await prisma.governanceWorkflow.findFirst({ where: { assetId: asset.id, toStatus: "UNDER_REVIEW" }, orderBy: { timestamp: "desc" } });

      if (underReviewStep?.approvedById === req.user!.id) {
        res.status(403).json({ error: "Segregation of duties prevents approving an asset you moved to review" });
        return;
      }
    }

    if (body.toStatus === "APPROVED" || body.toStatus === "DEPLOYED") {
      const blockingRisks = await prisma.risk.findMany({
        where: { archived: false, assets: { some: { assetId: asset.id } }, status: { in: ["OPEN", "IN_PROGRESS"] }, inherentRiskScore: { gte: HIGH_SEVERITY_MIN_SCORE } },
        select: { id: true, description: true, inherentRiskScore: true },
      });

      if (blockingRisks.length) {
        res.status(400).json({ error: "Asset has open high or critical risks", blockingRisks });
        return;
      }

      if (asset.type === "MODEL" || asset.type === "SERVICE") {
        const modelCard = await prisma.modelCard.findUnique({ where: { assetId: asset.id } });
        const completeness = modelCardCompleteness(modelCard);

        if (completeness.missingFields.length) {
          res.status(400).json({ error: "Model card incomplete", missingFields: completeness.missingFields });
          return;
        }
      }
    }

    const stepIndex = await prisma.governanceWorkflow.count({ where: { assetId: asset.id } });

    const result = await prisma.$transaction(async (tx) => {
      const updatedAsset = await tx.aIAsset.update({ where: { id: asset.id }, data: { status: body.toStatus } });
      const workflow = await tx.governanceWorkflow.create({
        data: {
          assetId: asset.id,
          fromStatus: asset.status,
          toStatus: body.toStatus,
          stepIndex,
          requiredRole: requiredRoleForTransition(body.toStatus),
          approvedById: req.user!.id,
          comments: body.comments,
        },
      });
      return { asset: updatedAsset, workflow };
    });
    await audit(req.user!.id, "AIAsset", result.asset.id, "TRANSITION", asset, result.asset);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id/projects", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const links = await prisma.projectAsset.findMany({ where: { assetId: id }, include: { project: true }, orderBy: { linkedAt: "desc" } });
    res.json({ projects: links.map((link) => link.project) });
  } catch (error) {
    next(error);
  }
});

app.post("/assets/:assetId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.assetId);
    const riskId = String(req.params.riskId);
    const link = await prisma.assetRisk.upsert({ where: { assetId_riskId: { assetId, riskId } }, update: {}, create: { assetId, riskId } });
    await audit(req.user!.id, "AssetRisk", link.id, "CREATE", undefined, link);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

app.delete("/assets/:assetId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.assetId);
    const riskId = String(req.params.riskId);
    const before = await prisma.assetRisk.findUniqueOrThrow({ where: { assetId_riskId: { assetId, riskId } } });
    await prisma.assetRisk.delete({ where: { assetId_riskId: { assetId, riskId } } });
    await audit(req.user!.id, "AssetRisk", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/assets/:parentAssetId/dependencies/:childAssetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const parentAssetId = String(req.params.parentAssetId);
    const childAssetId = String(req.params.childAssetId);
    const dependency = await prisma.assetDependency.upsert({ where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } }, update: {}, create: { parentAssetId, childAssetId } });
    await audit(req.user!.id, "AssetDependency", dependency.id, "CREATE", undefined, dependency);
    res.status(201).json({ dependency });
  } catch (error) {
    next(error);
  }
});

app.delete("/assets/:parentAssetId/dependencies/:childAssetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const parentAssetId = String(req.params.parentAssetId);
    const childAssetId = String(req.params.childAssetId);
    const before = await prisma.assetDependency.findUniqueOrThrow({ where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } } });
    await prisma.assetDependency.delete({ where: { parentAssetId_childAssetId: { parentAssetId, childAssetId } } });
    await audit(req.user!.id, "AssetDependency", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id/recertification", requireAuth, async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const recertification = await prisma.recertificationSchedule.findUnique({ where: { assetId } });
    res.json({ recertification });
  } catch (error) {
    next(error);
  }
});

app.post("/assets/:id/recertification", requireAuth, requireRole("ADMIN", "APPROVER"), async (req, res, next) => {
  try {
    const assetId = String(req.params.id);
    const body = z.object({ cadenceDays: z.number().int().min(1), nextDueDate: z.string().datetime() }).parse(req.body);
    const before = await prisma.recertificationSchedule.findUnique({ where: { assetId } });
    const recertification = await prisma.recertificationSchedule.upsert({
      where: { assetId },
      update: { cadenceDays: body.cadenceDays, nextDueDate: new Date(body.nextDueDate) },
      create: { assetId, cadenceDays: body.cadenceDays, nextDueDate: new Date(body.nextDueDate) },
    });
    await audit(req.user!.id, "RecertificationSchedule", recertification.id, before ? "UPDATE" : "CREATE", before, recertification);
    res.json({ recertification });
  } catch (error) {
    next(error);
  }
});

app.get("/projects", requireAuth, async (req, res, next) => {
  try {
    const status = req.query.status as string | undefined;
    const page = pagination(req.query);
    const where = status ? { status: status as never } : {};
    const total = await prisma.project.count({ where });
    const projects = await prisma.project.findMany({
      where,
      include: { _count: { select: { assetLinks: true, riskLinks: true } }, createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { updatedAt: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ projects, pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

app.post("/projects", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const body = projectSchema.parse(req.body);
    const project = await prisma.project.create({ data: { ...body, createdById: req.user!.id } });
    await audit(req.user!.id, "Project", project.id, "CREATE", undefined, project);
    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

app.get("/projects/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { assetLinks: { include: { asset: true } }, riskLinks: { include: { risk: true } }, createdBy: { select: { id: true, name: true, email: true } } },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.put("/projects/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = projectSchema.parse(req.body);
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    const project = await prisma.project.update({ where: { id }, data: body });
    await audit(req.user!.id, "Project", id, "UPDATE", before, project);
    res.json({ project });
  } catch (error) {
    next(error);
  }
});

app.delete("/projects/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.project.findUniqueOrThrow({ where: { id } });
    await prisma.project.delete({ where: { id } });
    await audit(req.user!.id, "Project", id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/projects/:projectId/assets/:assetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const assetId = String(req.params.assetId);
    const link = await prisma.projectAsset.upsert({ where: { projectId_assetId: { projectId, assetId } }, update: {}, create: { projectId, assetId } });
    await audit(req.user!.id, "ProjectAsset", link.id, "CREATE", undefined, link);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

app.delete("/projects/:projectId/assets/:assetId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const assetId = String(req.params.assetId);
    const before = await prisma.projectAsset.findUniqueOrThrow({ where: { projectId_assetId: { projectId, assetId } } });
    await prisma.projectAsset.delete({ where: { projectId_assetId: { projectId, assetId } } });
    await audit(req.user!.id, "ProjectAsset", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/projects/:projectId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const riskId = String(req.params.riskId);
    const link = await prisma.projectRisk.upsert({ where: { projectId_riskId: { projectId, riskId } }, update: {}, create: { projectId, riskId } });
    await audit(req.user!.id, "ProjectRisk", link.id, "CREATE", undefined, link);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

app.delete("/projects/:projectId/risks/:riskId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const projectId = String(req.params.projectId);
    const riskId = String(req.params.riskId);
    const before = await prisma.projectRisk.findUniqueOrThrow({ where: { projectId_riskId: { projectId, riskId } } });
    await prisma.projectRisk.delete({ where: { projectId_riskId: { projectId, riskId } } });
    await audit(req.user!.id, "ProjectRisk", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/projects/:id/risks", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUniqueOrThrow({
      where: { id },
      include: {
        riskLinks: { include: { risk: { include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } } } },
        assetLinks: { include: { asset: { include: { riskLinks: { include: { risk: { include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } } } } } } } },
      },
    });
    const risks = new Map<string, unknown>();
    for (const link of project.riskLinks) risks.set(link.riskId, { ...riskResponse(link.risk), origin: "project" });
    for (const assetLink of project.assetLinks) {
      for (const riskLink of assetLink.asset.riskLinks) {
        if (!risks.has(riskLink.riskId)) risks.set(riskLink.riskId, { ...riskResponse(riskLink.risk), origin: "asset" });
      }
    }
    res.json({ risks: [...risks.values()] });
  } catch (error) {
    next(error);
  }
});

app.get("/risks", requireAuth, async (req, res, next) => {
  try {
    const { assetId, sourceFramework, status } = req.query;
    const includeArchived = req.query.includeArchived === "true";
    const page = pagination(req.query);
    const where = {
      ...(includeArchived ? {} : { archived: false }),
      ...(assetId ? { assets: { some: { assetId: String(assetId) } } } : {}),
      ...(sourceFramework ? { sourceFramework: sourceFramework as never } : {}),
      ...(status ? { status: status as never } : {}),
    };
    const total = await prisma.risk.count({ where });
    const risks = await prisma.risk.findMany({
      where,
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
      orderBy: { inherentRiskScore: "desc" },
      skip: page.skip,
      take: page.take,
    });
    res.json({ risks: risks.map(riskResponse), pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

app.post("/risks", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const body = riskSchema.parse(req.body);
    const { assetId, ...riskData } = body;
    const risk = await prisma.risk.create({
      data: {
        ...riskData,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        inherentRiskScore: body.likelihood * body.impact,
        createdById: req.user!.id,
        assets: { create: { assetId } },
      },
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
    });
    await audit(req.user!.id, "Risk", risk.id, "CREATE", undefined, risk);
    res.status(201).json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

app.get("/risks/:id", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const risk = await prisma.risk.findUnique({ where: { id }, include: { assets: { include: { asset: true } }, projects: { include: { project: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true } });

    if (!risk) {
      res.status(404).json({ error: "Risk not found" });
      return;
    }

    res.json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

app.get("/controls", requireAuth, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const controls = await prisma.control.findMany({ where: includeArchived ? {} : { archived: false }, include: { _count: { select: { links: true } } }, orderBy: [{ mappedFramework: "asc" }, { mappedControlId: "asc" }] });
    res.json({ controls });
  } catch (error) {
    next(error);
  }
});

app.put("/risks/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = riskSchema.parse(req.body);
    const { assetId, ...riskData } = body;
    const before = await prisma.risk.findUniqueOrThrow({ where: { id }, include: { assets: true, controlLinks: { include: { control: true } }, frameworkCategory: true } });

    if (req.user!.role === "RISK_OWNER" && before.createdById !== req.user!.id) {
      res.status(403).json({ error: "RISK_OWNER can only edit risks they created" });
      return;
    }

    if (riskData.status === "ACCEPTED" && before.createdById === req.user!.id) {
      res.status(403).json({ error: "Segregation of duties prevents accepting a risk you created" });
      return;
    }

    const risk = await prisma.risk.update({
      where: { id },
      data: {
        ...riskData,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        inherentRiskScore: body.likelihood * body.impact,
        assets: { connectOrCreate: { where: { assetId_riskId: { assetId, riskId: id } }, create: { assetId } } },
      },
      include: { assets: { include: { asset: true } }, controlLinks: { include: { control: true } }, frameworkCategory: true },
    });
    if (before.status !== risk.status) {
      await sendSlackRiskStatusChange({ riskId: risk.id, description: risk.description, fromStatus: before.status, toStatus: risk.status });
    }
    await audit(req.user!.id, "Risk", risk.id, "UPDATE", before, risk);
    res.json({ risk: riskResponse(risk) });
  } catch (error) {
    next(error);
  }
});

app.delete("/risks/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.risk.findUniqueOrThrow({ where: { id }, include: { assets: true, projects: true, controlLinks: { include: { control: true } } } });
    const hasLinks = before.assets.length > 0 || before.projects.length > 0 || before.controlLinks.length > 0;

    if (hasLinks) {
      const risk = await prisma.risk.update({ where: { id }, data: { archived: true } });
      await audit(req.user!.id, "Risk", id, "ARCHIVE", before, risk);
    } else {
      await prisma.risk.delete({ where: { id } });
      await audit(req.user!.id, "Risk", id, "DELETE", before, undefined);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/risks/:riskId/controls", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const body = controlSchema.parse(req.body);
    const control = await prisma.control.upsert({
      where: { mappedFramework_mappedControlId: { mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId } },
      update: { name: body.mappedControlId, archived: false },
      create: { name: body.mappedControlId, mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId },
    });
    const link = await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId, controlId: control.id } },
      update: { implementationStatus: body.implementationStatus, evidenceNotes: body.evidenceNotes },
      create: { riskId, controlId: control.id, implementationStatus: body.implementationStatus, evidenceNotes: body.evidenceNotes },
      include: { control: true },
    });
    const response = { ...link.control, implementationStatus: link.implementationStatus, evidenceNotes: link.evidenceNotes };
    await audit(req.user!.id, "Control", control.id, "CREATE", undefined, response);
    res.status(201).json({ control: response });
  } catch (error) {
    next(error);
  }
});

app.post("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const body = z.object({ implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(), evidenceNotes: z.string().optional().nullable() }).parse(req.body);
    const link = await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId, controlId } },
      update: body,
      create: { riskId, controlId, ...body },
      include: { control: true },
    });
    await audit(req.user!.id, "RiskControl", link.id, "CREATE", undefined, link);
    res.status(201).json({ link });
  } catch (error) {
    next(error);
  }
});

app.put("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const body = z.object({ implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(), evidenceNotes: z.string().optional().nullable() }).parse(req.body);
    const before = await prisma.riskControl.findUniqueOrThrow({ where: { riskId_controlId: { riskId, controlId } } });
    const link = await prisma.riskControl.update({ where: { riskId_controlId: { riskId, controlId } }, data: body, include: { control: true } });
    await audit(req.user!.id, "RiskControl", link.id, "UPDATE", before, link);
    res.json({ link });
  } catch (error) {
    next(error);
  }
});

app.delete("/risks/:riskId/controls/:controlId", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const riskId = String(req.params.riskId);
    const controlId = String(req.params.controlId);
    const before = await prisma.riskControl.findUniqueOrThrow({ where: { riskId_controlId: { riskId, controlId } } });
    await prisma.riskControl.delete({ where: { riskId_controlId: { riskId, controlId } } });
    await audit(req.user!.id, "RiskControl", before.id, "DELETE", before, undefined);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.put("/controls/:id", requireAuth, requireRole("ADMIN", "RISK_OWNER"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = controlSchema.parse(req.body);
    const before = await prisma.control.findUniqueOrThrow({ where: { id } });
    const control = await prisma.control.update({ where: { id }, data: { name: body.mappedControlId, mappedFramework: body.mappedFramework, mappedControlId: body.mappedControlId } });
    await audit(req.user!.id, "Control", control.id, "UPDATE", before, control);
    res.json({ control });
  } catch (error) {
    next(error);
  }
});

app.delete("/controls/:id", requireAuth, requireRole("ADMIN"), async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const before = await prisma.control.findUniqueOrThrow({ where: { id }, include: { links: true } });

    if (before.links.length > 0) {
      const control = await prisma.control.update({ where: { id }, data: { archived: true } });
      await audit(req.user!.id, "Control", id, "ARCHIVE", before, control);
    } else {
      await prisma.control.delete({ where: { id } });
      await audit(req.user!.id, "Control", id, "DELETE", before, undefined);
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.get("/audit-logs", requireAuth, async (req, res, next) => {
  try {
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === "string" ? req.query.entityId : undefined;
    const page = pagination(req.query);
    const where = {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    };
    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        include: { actor: { select: { id: true, name: true, email: true } } },
        orderBy: { timestamp: "desc" },
        skip: page.skip,
        take: page.take,
      }),
    ]);

    res.json({ logs, pagination: { ...page, total } });
  } catch (error) {
    next(error);
  }
});

app.get("/search", requireAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json({ assets: [], projects: [], risks: [] });
      return;
    }
    const [assets, projects, risks] = await Promise.all([
      prisma.aIAsset.findMany({ where: { name: { contains: q, mode: "insensitive" } }, take: 10 }),
      prisma.project.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] }, take: 10 }),
      prisma.risk.findMany({ where: { description: { contains: q, mode: "insensitive" } }, take: 10 }),
    ]);
    res.json({ assets, projects, risks });
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/summary", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [assetStatus, assetType, hostingModel, networkDependency, projectCount, riskSeverityBuckets, topAssets] = await Promise.all([
      prisma.aIAsset.groupBy({ by: ["status"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["type"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["hostingModel"], _count: true }),
      prisma.aIAsset.groupBy({ by: ["networkDependency"], _count: true }),
      prisma.project.count(),
      countRiskSeverityBuckets(riskWhere),
      prisma.aIAsset.findMany({ include: { _count: { select: { projectLinks: true } } }, orderBy: { projectLinks: { _count: "desc" } }, take: 10 }),
    ]);
    res.json({ assetStatus, assetType, hostingModel, networkDependency, projectCount, riskSeverityBuckets, topAssets: topAssets.map(assetListResponse) });
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/exposure", requireAuth, async (req, res, next) => {
  try {
    const includeArchived = req.query.includeArchived === "true";
    const risks = await prisma.risk.findMany({
      where: { ...(includeArchived ? {} : { archived: false }), status: { in: ["OPEN", "IN_PROGRESS"] }, inherentRiskScore: { gte: HIGH_SEVERITY_MIN_SCORE } },
      include: { assets: { include: { asset: true } }, projects: { include: { project: true } } },
      orderBy: { inherentRiskScore: "desc" },
      take: 50,
    });
    res.json({ exposures: risks.map((risk) => ({ ...risk, severity: severityOf(risk.inherentRiskScore) })) });
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/recertification", requireAuth, async (req, res, next) => {
  try {
    const days = Math.max(Number(req.query.days ?? 30) || 30, 0);
    const now = new Date();
    const dueBy = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const schedules = await prisma.recertificationSchedule.findMany({
      where: {
        nextDueDate: { lte: dueBy },
        asset: { type: { in: ["MODEL", "SERVICE"] } },
      },
      include: { asset: true },
      orderBy: { nextDueDate: "asc" },
    });

    res.json({
      dueWithinDays: days,
      recertifications: schedules.map((schedule) => ({
        ...schedule,
        dueStatus: schedule.nextDueDate < now ? "OVERDUE" : "DUE_SOON",
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/dashboard/model-card-coverage", requireAuth, async (_req, res, next) => {
  try {
    const assets = await prisma.aIAsset.findMany({
      where: { type: { in: ["MODEL", "SERVICE"] } },
      include: { modelCard: true },
      orderBy: { updatedAt: "desc" },
    });
    const withCard = assets.filter((asset) => asset.modelCard).length;
    const completenessScores = assets.map((asset) => modelCardCompleteness(asset.modelCard).percent);
    const averageCompleteness = completenessScores.length ? Math.round(completenessScores.reduce((sum, percent) => sum + percent, 0) / completenessScores.length) : 0;

    res.json({
      total: assets.length,
      withCard,
      withoutCard: assets.length - withCard,
      averageCompleteness,
      missingAssets: assets.filter((asset) => !asset.modelCard).map((asset) => ({ id: asset.id, name: asset.name, type: asset.type, status: asset.status })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/reports/framework-coverage", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [categories, risks] = await Promise.all([
      prisma.frameworkCategory.findMany({ orderBy: [{ framework: "asc" }, { categoryId: "asc" }] }),
      prisma.risk.groupBy({ by: ["sourceFramework", "sourceCategoryId"], where: riskWhere, _count: true }),
    ]);
    const riskCounts = new Map(risks.map((risk) => [`${risk.sourceFramework}:${risk.sourceCategoryId}`, risk._count]));
    res.json({ coverage: categories.map((category) => ({ ...category, riskCount: riskCounts.get(`${category.framework}:${category.categoryId}`) ?? 0 })) });
  } catch (error) {
    next(error);
  }
});

app.get("/reports/risk-summary", requireAuth, async (req, res, next) => {
  try {
    const riskWhere = req.query.includeArchived === "true" ? {} : { archived: false };
    const [total, statusGroups, frameworkGroups, bySeverity] = await Promise.all([
      prisma.risk.count({ where: riskWhere }),
      prisma.risk.groupBy({ by: ["status"], where: riskWhere, _count: true }),
      prisma.risk.groupBy({ by: ["sourceFramework"], where: riskWhere, _count: true }),
      countRiskSeverityBuckets(riskWhere),
    ]);
    const byStatus = Object.fromEntries(statusGroups.map((risk) => [risk.status, risk._count]));
    const byFramework = Object.fromEntries(frameworkGroups.map((risk) => [risk.sourceFramework, risk._count]));
    res.json({ total, byStatus, byFramework, bySeverity });
  } catch (error) {
    next(error);
  }
});

app.get("/reports/model-metrics", requireAuth, async (req, res, next) => {
  try {
    const metricName = typeof req.query.metricName === "string" ? req.query.metricName : undefined;
    const metrics = await prisma.modelCardMetric.findMany({
      where: metricName ? { metricName } : undefined,
      include: { modelCard: { include: { asset: true } } },
      orderBy: [{ metricName: "asc" }, { recordedAt: "desc" }],
    });
    const aggregate = new Map<string, { group: string; values: number[] }>();

    for (const metric of metrics) {
      for (const group of [metric.modelCard.task, metric.modelCard.architectureFamily].filter((value): value is string => Boolean(value))) {
        const key = group;
        const entry = aggregate.get(key) ?? { group: key, values: [] };
        entry.values.push(metric.metricValue);
        aggregate.set(key, entry);
      }
    }

    res.json({
      metrics: metrics.map((metric) => ({
        id: metric.id,
        metricName: metric.metricName,
        metricValue: metric.metricValue,
        slice: metric.slice,
        recordedAt: metric.recordedAt,
        asset: { id: metric.modelCard.asset.id, name: metric.modelCard.asset.name },
        task: metric.modelCard.task,
        architectureFamily: metric.modelCard.architectureFamily,
      })),
      aggregate: [...aggregate.values()].map((entry) => ({
        group: entry.group,
        avg: entry.values.reduce((total, value) => total + value, 0) / entry.values.length,
        min: Math.min(...entry.values),
        max: Math.max(...entry.values),
        count: entry.values.length,
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id/export/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id }, include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    const bom = buildCycloneDxBom([assetForBom(asset) as never]);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      res.status(500).json({ error: "Generated CycloneDX BOM failed schema validation", validation });
      return;
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

app.get("/assets/:id/export/spdx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const asset = await prisma.aIAsset.findUnique({ where: { id } });

    if (!asset) {
      res.status(404).json({ error: "Asset not found" });
      return;
    }

    res.json(buildSpdxDocument([asset]));
  } catch (error) {
    next(error);
  }
});

app.get("/projects/:id/export/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const project = await prisma.project.findUnique({
      where: { id },
      include: { assetLinks: { include: { asset: { include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } } } } },
    });

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const bom = buildCycloneDxBom(project.assetLinks.map((link) => assetForBom(link.asset)) as never);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      res.status(500).json({ error: "Generated CycloneDX BOM failed schema validation", validation });
      return;
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

app.post("/exports/cyclonedx", requireAuth, async (req, res, next) => {
  try {
    const body = z.object({ assetIds: z.array(z.string()).min(1) }).parse(req.body);
    const assets = await prisma.aIAsset.findMany({ where: { id: { in: body.assetIds } }, include: { modelCard: { include: { metrics: true } }, riskLinks: { include: { risk: { include: { controlLinks: { include: { control: true } } } } } } } });

    if (assets.length !== body.assetIds.length) {
      res.status(404).json({ error: "One or more assets were not found" });
      return;
    }

    const bom = buildCycloneDxBom(assets.map(assetForBom) as never);
    const validation = await validateCycloneDxBom(bom);

    if (!validation.valid) {
      res.status(500).json({ error: "Generated CycloneDX BOM failed schema validation", validation });
      return;
    }

    res.json(bom);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Validation failed", details: error.flatten() });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({ error: "Record not found" });
    return;
  }

  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

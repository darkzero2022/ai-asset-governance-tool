import { z } from "zod";
import { STRIDE_AI_CATEGORIES } from "./strideAtlas.js";

export const assetSchema = z.object({
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
  sourceUrl: z.string().url().optional().nullable(),
});

export const importUrlSchema = z.object({ sourceUrl: z.string().url() });

export const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  businessOwner: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "RETIRED"]).optional(),
});

export const modelCardSchema = z.object({
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

export const modelCardMetricSchema = z.object({
  metricName: z.string().min(1),
  metricValue: z.number(),
  slice: z.string().optional().nullable(),
  recordedAt: z.string().datetime().optional(),
});

export const riskSchema = z.object({
  assetId: z.string().min(1),
  sourceFramework: z.enum(["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]),
  sourceCategoryId: z.string().min(1),
  euAiActRiskTier: z.enum(["UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"]).optional().nullable(),
  strideAiCategory: z.enum(STRIDE_AI_CATEGORIES).optional().nullable(),
  atlasTechnique: z.string().min(1).optional().nullable(),
  description: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualRiskScore: z.number().int().min(1).max(25).optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"]).optional(),
});

export const controlSchema = z.object({
  mappedFramework: z.enum(["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"]),
  mappedControlId: z.string().min(1),
  implementationStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"]).optional(),
  evidenceNotes: z.string().optional().nullable(),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"]),
  password: z.string().min(8),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

// Update variants carry an optimistic-concurrency token: the updatedAt the
// client last saw. The server rejects the write (409 STALE_WRITE) if the row
// has changed since. Omitted -> no check (backwards compatible).
const withLock = { expectedUpdatedAt: z.string().datetime().optional() };
export const assetUpdateSchema = assetSchema.extend(withLock);
export const projectUpdateSchema = projectSchema.extend(withLock);
export const riskUpdateSchema = riskSchema.extend(withLock);
export const controlUpdateSchema = controlSchema.extend(withLock);
export const modelCardUpdateSchema = modelCardSchema.extend(withLock);

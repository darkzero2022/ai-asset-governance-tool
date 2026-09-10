import { z } from "zod";
import { isCommonPassword } from "./passwords.js";
import {
  ASSET_TYPES,
  CONTROL_STATUSES,
  EU_AI_ACT_TIERS,
  HOSTING_MODELS,
  NETWORK_DEPENDENCIES,
  PROJECT_STATUSES,
  RISK_STATUSES,
  ROLES,
  SOURCE_FRAMEWORKS,
  STRIDE_AI_CATEGORIES,
  THREAT_MODEL_ELEMENT_TYPES,
  THREAT_MODEL_THREAT_STATUSES,
} from "./enums.js";

export const assetSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  type: z.enum(ASSET_TYPES),
  supplier: z.string().min(1),
  provider: z.string().optional().nullable(),
  hostingModel: z.enum(HOSTING_MODELS),
  networkDependency: z.enum(NETWORK_DEPENDENCIES).optional(),
  license: z.string().optional().nullable(),
  dataClassificationTouched: z.string().optional().nullable(),
  trainingDataProvenance: z.string().optional().nullable(),
  downstreamConsumers: z.string().optional().nullable(),
  // Accept "" from an untouched form field as "no URL" rather than a validation error.
  sourceUrl: z.preprocess(
    (value) => (value === "" ? null : value),
    z.string().url().optional().nullable(),
  ),
});

export const importUrlSchema = z.object({ sourceUrl: z.string().url() });

export const projectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  businessOwner: z.string().optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
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
  sourceFramework: z.enum(SOURCE_FRAMEWORKS),
  sourceCategoryId: z.string().min(1),
  euAiActRiskTier: z.enum(EU_AI_ACT_TIERS).optional().nullable(),
  strideAiCategory: z.enum(STRIDE_AI_CATEGORIES).optional().nullable(),
  atlasTechnique: z.string().min(1).optional().nullable(),
  // MITRE ATLAS mitigations attached to the remediation plan. Each entry must
  // match an AtlasMitigationReference row (enforced server-side, not in zod).
  atlasMitigations: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  likelihood: z.number().int().min(1).max(5),
  impact: z.number().int().min(1).max(5),
  residualRiskScore: z.number().int().min(1).max(25).optional().nullable(),
  treatmentPlan: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  status: z.enum(RISK_STATUSES).optional(),
});

export const controlSchema = z.object({
  mappedFramework: z.enum(SOURCE_FRAMEWORKS),
  mappedControlId: z.string().min(1),
  implementationStatus: z.enum(CONTROL_STATUSES).optional(),
  evidenceNotes: z.string().optional().nullable(),
});

// Password policy: >= 12 chars and not on the common/breached deny-list.
export const PASSWORD_POLICY_HINT =
  "At least 12 characters, and not a common or previously-breached password.";
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .refine(
    (value) => !isCommonPassword(value),
    "This password is too common — choose something less predictable",
  );

export const userCreateSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
  password: passwordSchema.optional(),
  mustChangePassword: z.boolean().optional(),
});

export const bootstrapSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).optional(),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // A 6-digit TOTP or a "xxxx-xxxx" recovery code, supplied on the second step
  // when the account has 2FA enabled.
  totpCode: z.string().min(6).max(32).optional(),
});

export const totpEnableSchema = z.object({ code: z.string().min(6).max(10) });
export const totpDisableSchema = z.object({ password: z.string().min(1) });

// --- Threat modelling ---

export const threatModelCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
export const threatModelUpdateSchema = threatModelCreateSchema.partial().extend({
  expectedUpdatedAt: z.string().datetime().optional(),
});

export const trustBoundarySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
});

export const threatModelElementSchema = z.object({
  type: z.enum(THREAT_MODEL_ELEMENT_TYPES),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  trustBoundaryId: z.string().nullable().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
});

export const threatModelFlowSchema = z.object({
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  label: z.string().min(1).max(120),
  protocol: z.string().max(60).optional(),
  authenticated: z.boolean().optional(),
  encrypted: z.boolean().optional(),
});

export const threatStatusSchema = z.object({
  status: z.enum(THREAT_MODEL_THREAT_STATUSES),
});

// Update variants carry an optimistic-concurrency token: the updatedAt the client
// last saw. The server rejects the write (409 STALE_WRITE) if the row moved on.
const withLock = { expectedUpdatedAt: z.string().datetime().optional() };
export const assetUpdateSchema = assetSchema.extend(withLock);
export const projectUpdateSchema = projectSchema.extend(withLock);
export const riskUpdateSchema = riskSchema.extend(withLock);
export const controlUpdateSchema = controlSchema.extend(withLock);
export const modelCardUpdateSchema = modelCardSchema.extend(withLock);

export type AssetInput = z.infer<typeof assetSchema>;
export type ProjectInput = z.infer<typeof projectSchema>;
export type RiskInput = z.infer<typeof riskSchema>;
export type ControlInput = z.infer<typeof controlSchema>;
export type ModelCardInput = z.infer<typeof modelCardSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

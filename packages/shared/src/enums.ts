export const ASSET_TYPES = ["MODEL", "DATASET", "SERVICE", "LIBRARY"] as const;
export const HOSTING_MODELS = ["SAAS_API", "SELF_HOSTED", "EMBEDDED_IN_APP"] as const;
export const NETWORK_DEPENDENCIES = ["AIR_GAPPED", "HYBRID", "FULLY_CONNECTED"] as const;
export const ASSET_STATUSES = ["DRAFT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "RETIRED"] as const;
export const PROJECT_STATUSES = ["ACTIVE", "INACTIVE", "RETIRED"] as const;
export const RISK_STATUSES = ["OPEN", "IN_PROGRESS", "MITIGATED", "ACCEPTED"] as const;
export const SOURCE_FRAMEWORKS = ["NIST_AI_RMF", "EU_AI_ACT", "OWASP_LLM_TOP10"] as const;
export const EU_AI_ACT_TIERS = ["UNACCEPTABLE", "HIGH", "LIMITED", "MINIMAL"] as const;
export const CONTROL_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "IMPLEMENTED", "VERIFIED"] as const;
export const ROLES = ["ADMIN", "RISK_OWNER", "APPROVER", "VIEWER"] as const;

export const STRIDE_AI_CATEGORIES = [
  "MODEL_IMPERSONATION",
  "DATA_MODEL_POISONING",
  "PROVENANCE_LOSS",
  "MODEL_INVERSION",
  "RESOURCE_EXHAUSTION",
  "ALIGNMENT_BYPASS",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type HostingModel = (typeof HOSTING_MODELS)[number];
export type NetworkDependency = (typeof NETWORK_DEPENDENCIES)[number];
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type RiskStatus = (typeof RISK_STATUSES)[number];
export type SourceFramework = (typeof SOURCE_FRAMEWORKS)[number];
export type EuAiActTier = (typeof EU_AI_ACT_TIERS)[number];
export type ControlStatus = (typeof CONTROL_STATUSES)[number];
export type Role = (typeof ROLES)[number];
export type StrideAiCategory = (typeof STRIDE_AI_CATEGORIES)[number];

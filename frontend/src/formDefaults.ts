export type ProjectForm = {
  name: string;
  description: string;
  businessOwner: string;
  status: string;
};

export const emptyProject: ProjectForm = {
  name: "",
  description: "",
  businessOwner: "",
  status: "ACTIVE",
};

export const emptyAiSystem = {
  name: "",
  version: "1.0",
  type: "SERVICE",
  supplier: "",
  provider: "",
  hostingModel: "SAAS_API",
  networkDependency: "FULLY_CONNECTED",
  license: "",
  dataClassificationTouched: "",
  trainingDataProvenance: "",
  downstreamConsumers: "",
  sourceUrl: "",
};

export type ImportSuggestion = {
  sourceUrl: string;
  suggestedTitle: string;
  suggestedDescription: string;
  excerpt: string;
};

export const emptyRisk = {
  assetId: "",
  sourceFramework: "OWASP_LLM_TOP10",
  sourceCategoryId: "LLM01",
  euAiActRiskTier: "",
  strideAiCategory: "",
  atlasTechnique: "",
  atlasMitigations: [] as string[],
  description: "",
  likelihood: 3,
  impact: 3,
  residualRiskScore: "",
  treatmentPlan: "",
  owner: "",
  dueDate: "",
  status: "OPEN",
};

// AssetList/RiskRegister each declare their own local Filters type covering
// all six fields (they share a page layout heritage) even though a given
// page only reads the ones it renders controls for — this default satisfies
// both shapes so each route can hold its own independent filter state.
export const emptyFilters = {
  assetStatus: "",
  assetType: "",
  hostingModel: "",
  networkDependency: "",
  riskStatus: "",
  sourceFramework: "",
};

export const nextStatuses: Record<string, string[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["DEPLOYED", "UNDER_REVIEW"],
  DEPLOYED: ["RETIRED"],
  RETIRED: [],
};

export function label(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

// Framework enum keys prettify badly through label() ("Owasp Mcp Top10"), so
// give the source frameworks proper display names in one place.
export const FRAMEWORK_LABELS: Record<string, string> = {
  NIST_AI_RMF: "NIST AI RMF",
  EU_AI_ACT: "EU AI Act",
  OWASP_LLM_TOP10: "OWASP LLM Top 10",
  OWASP_MCP_TOP10: "OWASP MCP Top 10",
};

export function frameworkLabel(value: string) {
  return FRAMEWORK_LABELS[value] ?? label(value);
}

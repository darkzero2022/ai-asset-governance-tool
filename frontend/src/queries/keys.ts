/**
 * One query key scheme for the whole app. A filter object is included
 * verbatim in list keys so each distinct filter combination caches
 * separately; invalidating the bare prefix (e.g. ["assets"]) drops every
 * variant regardless of filters.
 */
export const queryKeys = {
  currentUser: () => ["auth", "me"] as const,
  assets: (filters?: Record<string, string>) => ["assets", filters ?? {}] as const,
  asset: (id: string) => ["asset", id] as const,
  assetProjects: (id: string) => ["asset", id, "projects"] as const,
  assetModelCard: (id: string) => ["asset", id, "model-card"] as const,
  risks: (filters?: Record<string, string>) => ["risks", filters ?? {}] as const,
  risk: (id: string) => ["risk", id] as const,
  projects: () => ["projects"] as const,
  project: (id: string) => ["project", id] as const,
  projectRisks: (id: string) => ["project", id, "risks"] as const,
  controls: () => ["controls"] as const,
  users: () => ["users"] as const,
  frameworkCategories: () => ["reference", "framework-categories"] as const,
  atlasTechniques: () => ["reference", "atlas-techniques"] as const,
  atlasMitigations: () => ["reference", "atlas-mitigations"] as const,
  auditLogs: (entityType: string, entityId: string) => ["auditLogs", entityType, entityId] as const,
};

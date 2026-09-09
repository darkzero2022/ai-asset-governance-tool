import type {
  AssetStatus,
  AssetType,
  ControlStatus,
  EuAiActTier,
  FrameworkStatus,
  HostingModel,
  NetworkDependency,
  ProjectStatus,
  Role,
  RiskStatus,
  SourceFramework,
  StrideAiCategory,
} from "./enums.js";

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface UserRef {
  id?: string;
  name: string;
  email: string;
}

export interface Asset {
  id: string;
  name: string;
  version: string;
  type: AssetType | string;
  supplier: string;
  provider?: string | null;
  hostingModel: HostingModel | string;
  networkDependency: NetworkDependency | string;
  license?: string | null;
  dataClassificationTouched?: string | null;
  trainingDataProvenance?: string | null;
  downstreamConsumers?: string | null;
  sourceUrl?: string | null;
  status: AssetStatus | string;
  createdAt?: string;
  updatedAt: string;
  createdBy?: UserRef;
  // `assetListResponse` always sets `_count.risks`; other shapes may add these.
  _count?: { risks: number; riskLinks?: number; projectLinks?: number };
  projectUsageCount?: number;
}

export interface Control {
  id: string;
  name: string;
  mappedFramework: SourceFramework | string;
  mappedControlId: string;
  description?: string | null;
  implementationStatus?: ControlStatus | string;
  evidenceNotes?: string | null;
  archived?: boolean;
  updatedAt?: string;
  _count?: { links?: number };
}

export interface Risk {
  id: string;
  assetId: string;
  description: string;
  sourceFramework: SourceFramework | string;
  sourceCategoryId: string;
  euAiActRiskTier?: EuAiActTier | string | null;
  strideAiCategory?: StrideAiCategory | string | null;
  atlasTechnique?: string | null;
  atlasMitigations?: string[];
  likelihood: number;
  impact: number;
  inherentRiskScore: number;
  residualRiskScore?: number | null;
  treatmentPlan?: string | null;
  owner?: string | null;
  dueDate?: string | null;
  status: RiskStatus | string;
  severity?: Severity | string | null;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  createdById?: string;
  asset?: { name: string } | null;
  assets?: Array<{ assetId: string; asset: Asset }>;
  projects?: Array<{ projectId: string; project: Project }>;
  controls?: Array<Control & { implementationStatus?: string; evidenceNotes?: string | null }>;
  controlLinks?: Array<{ control: Control; implementationStatus?: string; evidenceNotes?: string | null }>;
  frameworkCategory?: FrameworkCategory | null;
  /** Categories in other frameworks our seeded crosswalk relates this risk to. Read-only. */
  relatedClassifications?: RelatedClassification[];
}

export interface RelatedClassification {
  framework: SourceFramework | string;
  categoryId: string;
  categoryName: string;
  relationship: "EQUIVALENT" | "RELATED" | "BROADER" | "NARROWER" | string;
  rationale?: string | null;
}

export interface FrameworkMeta {
  framework: SourceFramework | string;
  title: string;
  revision: string;
  status: FrameworkStatus | string;
  sourceUrl: string;
  licenseNote?: string | null;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  status: ProjectStatus | string;
  businessOwner?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: UserRef;
  _count?: { assetLinks?: number; riskLinks?: number };
  assetLinks?: Array<{ assetId: string; asset: Asset }>;
  riskLinks?: Array<{ riskId: string; risk: Risk }>;
}

export interface WorkflowEntry {
  id: string;
  fromStatus: string;
  toStatus: string;
  comments?: string | null;
  timestamp: string;
  approvedBy: UserRef;
}

export interface AssetDetail extends Asset {
  risks: Risk[];
  workflow: WorkflowEntry[];
  parentDependencies?: Array<{ childAsset: { id: string; name: string; type: string } }>;
  childDependencies?: Array<{ parentAsset: { id: string; name: string; type: string } }>;
}

export interface AuditLog {
  id: string;
  action: string;
  timestamp: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  actor?: UserRef;
  beforeJson?: Record<string, unknown> | null;
  afterJson?: Record<string, unknown> | null;
}

export interface FrameworkCategory {
  id?: string;
  framework: SourceFramework | string;
  categoryId: string;
  name: string;
  description?: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role | string;
  active: boolean;
}

export interface Pagination {
  skip: number;
  take: number;
  total: number;
}

/** The API error envelope: `{ error: { code, message, details? }, requestId }`. */
export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export function apiErrorMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const err = (body as { error?: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return undefined;
}

export function apiErrorCode(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  const err = (body as { error?: unknown }).error;
  if (err && typeof err === "object" && "code" in err) {
    return String((err as { code: unknown }).code);
  }
  return undefined;
}

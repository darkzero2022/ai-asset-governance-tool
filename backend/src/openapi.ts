import type { Express, Router } from "express";
import swaggerUi from "swagger-ui-express";
import type { Role } from "@prisma/client";
import {
  ASSET_TYPES,
  HOSTING_MODELS,
  NETWORK_DEPENDENCIES,
  ASSET_STATUSES,
  PROJECT_STATUSES,
  RISK_STATUSES,
  SOURCE_FRAMEWORKS,
  EU_AI_ACT_TIERS,
  CONTROL_STATUSES,
  ROLES,
  STRIDE_AI_CATEGORIES,
} from "@aibom/shared";
import { requireAuth } from "./auth.js";

/**
 * Everything here is generated, not hand-maintained per route: the path list
 * comes from walking the actual mounted routers (collectRoutes), so it can
 * never drift from what /api/v1 really serves. Only the request-body shapes
 * for the main write endpoints are hand-declared, mirroring @aibom/shared's
 * zod schemas — response bodies are intentionally left generic (documented
 * below) rather than reverse-engineered field-by-field for all ~70 routes.
 */

const ENABLE_DOCS_FLAG = "ENABLE_API_DOCS";

export function apiDocsEnabled(): boolean {
  const flag = process.env[ENABLE_DOCS_FLAG]?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

interface RouteEntry {
  method: string;
  path: string;
  requiresAuth: boolean;
  roles: Role[] | null;
}

type ExpressLayer = {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: unknown }> };
  handle?: { stack?: ExpressLayer[] };
};

/**
 * Walks a Router's stack (including nested `.use()`d sub-routers) to discover
 * every registered route and its auth/role gate, by inspecting the actual
 * middleware chain rather than a separately maintained table.
 */
function collectRoutes(router: Router): RouteEntry[] {
  const routes: RouteEntry[] = [];
  const stack = (router as unknown as { stack: ExpressLayer[] }).stack ?? [];
  for (const layer of stack) {
    if (layer.route) {
      const { path, methods, stack: routeStack } = layer.route;
      const middlewares = routeStack.map((entry) => entry.handle);
      const requiresAuth = middlewares.includes(requireAuth as unknown);
      const roleMiddleware = middlewares.find((mw) =>
        Array.isArray((mw as { allowedRoles?: Role[] })?.allowedRoles),
      ) as { allowedRoles: Role[] } | undefined;
      for (const method of Object.keys(methods).filter((m) => methods[m])) {
        routes.push({ method, path, requiresAuth, roles: roleMiddleware?.allowedRoles ?? null });
      }
    } else if (layer.handle?.stack) {
      routes.push(...collectRoutes(layer.handle as unknown as Router));
    }
  }
  return routes;
}

function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
}

const TAG_BY_SEGMENT: Record<string, string> = {
  auth: "Auth",
  users: "Users",
  reference: "Reference",
  "ai-systems": "AI Systems",
  projects: "Projects",
  risks: "Risks",
  controls: "Controls",
  "audit-logs": "Audit",
  search: "Search",
  dashboard: "Dashboard",
  reports: "Reports",
  exports: "Exports",
};

function tagFor(path: string): string {
  return TAG_BY_SEGMENT[path.split("/")[1] ?? ""] ?? "Misc";
}

// Request-body schema refs for the endpoints whose write shape matters most.
// Everything else still appears in the path list with a generic request body.
const REQUEST_BODY_SCHEMAS: Record<string, string> = {
  "POST /auth/login": "LoginInput",
  "POST /auth/bootstrap": "BootstrapInput",
  "POST /auth/change-password": "ChangePasswordInput",
  "POST /ai-systems": "AssetInput",
  "PUT /ai-systems/:id": "AssetUpdateInput",
  "POST /ai-systems/import-url": "ImportUrlInput",
  "POST /ai-systems/:id/import-url": "ImportUrlInput",
  "POST /ai-systems/:id/transition": "AssetTransitionInput",
  "PUT /ai-systems/:id/model-card": "ModelCardUpdateInput",
  "POST /ai-systems/:id/model-card/metrics": "ModelCardMetricInput",
  "PUT /ai-systems/:id/model-card/metrics/:metricId": "ModelCardMetricInput",
  "POST /ai-systems/:id/recertification": "RecertificationInput",
  "POST /projects": "ProjectInput",
  "PUT /projects/:id": "ProjectUpdateInput",
  "POST /risks": "RiskInput",
  "PUT /risks/:id": "RiskUpdateInput",
  "POST /risks/:riskId/controls": "ControlInput",
  "PUT /risks/:riskId/controls/:controlId": "RiskControlLinkUpdateInput",
  "PUT /controls/:id": "ControlUpdateInput",
  "POST /users": "UserCreateInput",
  "PUT /users/:id": "UserUpdateInput",
  "POST /exports/cyclonedx": "CycloneDxExportInput",
};

const errorEnvelope = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: {},
      },
      required: ["code", "message"],
    },
    requestId: { type: "string" },
  },
  required: ["error"],
};

const lockFields = { expectedUpdatedAt: { type: "string", format: "date-time" } };

const assetProperties = {
  name: { type: "string", minLength: 1 },
  version: { type: "string", minLength: 1 },
  type: { type: "string", enum: ASSET_TYPES },
  supplier: { type: "string", minLength: 1 },
  provider: { type: "string", nullable: true },
  hostingModel: { type: "string", enum: HOSTING_MODELS },
  networkDependency: { type: "string", enum: NETWORK_DEPENDENCIES },
  license: { type: "string", nullable: true },
  dataClassificationTouched: { type: "string", nullable: true },
  trainingDataProvenance: { type: "string", nullable: true },
  downstreamConsumers: { type: "string", nullable: true },
  sourceUrl: { type: "string", format: "uri", nullable: true },
};
const assetRequired = ["name", "version", "type", "supplier", "hostingModel"];

const projectProperties = {
  name: { type: "string", minLength: 1 },
  description: { type: "string", nullable: true },
  businessOwner: { type: "string", nullable: true },
  status: { type: "string", enum: PROJECT_STATUSES },
};

const riskProperties = {
  assetId: { type: "string", minLength: 1 },
  sourceFramework: { type: "string", enum: SOURCE_FRAMEWORKS },
  sourceCategoryId: { type: "string", minLength: 1 },
  euAiActRiskTier: { type: "string", enum: EU_AI_ACT_TIERS, nullable: true },
  strideAiCategory: { type: "string", enum: STRIDE_AI_CATEGORIES, nullable: true },
  atlasTechnique: { type: "string", nullable: true },
  atlasMitigations: { type: "array", items: { type: "string" } },
  description: { type: "string", minLength: 1 },
  likelihood: { type: "integer", minimum: 1, maximum: 5 },
  impact: { type: "integer", minimum: 1, maximum: 5 },
  residualRiskScore: { type: "integer", minimum: 1, maximum: 25, nullable: true },
  treatmentPlan: { type: "string", nullable: true },
  owner: { type: "string", nullable: true },
  dueDate: { type: "string", format: "date-time", nullable: true },
  status: { type: "string", enum: RISK_STATUSES },
};
const riskRequired = [
  "assetId",
  "sourceFramework",
  "sourceCategoryId",
  "description",
  "likelihood",
  "impact",
];

const controlProperties = {
  mappedFramework: { type: "string", enum: SOURCE_FRAMEWORKS },
  mappedControlId: { type: "string", minLength: 1 },
  implementationStatus: { type: "string", enum: CONTROL_STATUSES },
  evidenceNotes: { type: "string", nullable: true },
};
const controlRequired = ["mappedFramework", "mappedControlId"];

const modelCardProperties = {
  approach: { type: "string", nullable: true },
  task: { type: "string", nullable: true },
  architectureFamily: { type: "string", nullable: true },
  modelArchitecture: { type: "string", nullable: true },
  datasetsDescription: { type: "string", nullable: true },
  inputsDescription: { type: "string", nullable: true },
  outputsDescription: { type: "string", nullable: true },
  intendedUsers: { type: "string", nullable: true },
  useCases: { type: "string", nullable: true },
  technicalLimitations: { type: "string", nullable: true },
  performanceTradeoffs: { type: "string", nullable: true },
  ethicalConsiderations: { type: "string", nullable: true },
  fairnessAssessments: { type: "string", nullable: true },
  environmentalConsiderations: { type: "string", nullable: true },
  performanceMetrics: {},
};

const schemas: Record<string, object> = {
  ErrorEnvelope: errorEnvelope,
  LoginInput: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 1 },
    },
    required: ["email", "password"],
  },
  BootstrapInput: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 1 },
      password: {
        type: "string",
        minLength: 12,
        description: "At least 12 characters, not a common/breached password.",
      },
    },
    required: ["email", "password"],
  },
  ChangePasswordInput: {
    type: "object",
    properties: {
      currentPassword: { type: "string", minLength: 1 },
      newPassword: {
        type: "string",
        minLength: 12,
        description: "At least 12 characters, not a common/breached password.",
      },
    },
    required: ["currentPassword", "newPassword"],
  },
  AssetInput: { type: "object", properties: assetProperties, required: assetRequired },
  AssetUpdateInput: {
    type: "object",
    properties: { ...assetProperties, ...lockFields },
    required: assetRequired,
  },
  AssetTransitionInput: {
    type: "object",
    properties: {
      toStatus: { type: "string", enum: ASSET_STATUSES },
      comments: { type: "string", nullable: true },
    },
    required: ["toStatus"],
  },
  ImportUrlInput: {
    type: "object",
    properties: { sourceUrl: { type: "string", format: "uri" } },
    required: ["sourceUrl"],
  },
  RecertificationInput: {
    type: "object",
    properties: {
      cadenceDays: { type: "integer", minimum: 1 },
      nextDueDate: { type: "string", format: "date-time" },
    },
    required: ["cadenceDays", "nextDueDate"],
  },
  ProjectInput: { type: "object", properties: projectProperties, required: ["name"] },
  ProjectUpdateInput: {
    type: "object",
    properties: { ...projectProperties, ...lockFields },
    required: ["name"],
  },
  RiskInput: { type: "object", properties: riskProperties, required: riskRequired },
  RiskUpdateInput: {
    type: "object",
    properties: { ...riskProperties, ...lockFields },
    required: riskRequired,
  },
  ControlInput: { type: "object", properties: controlProperties, required: controlRequired },
  ControlUpdateInput: {
    type: "object",
    properties: { ...controlProperties, ...lockFields },
    required: controlRequired,
  },
  RiskControlLinkUpdateInput: {
    type: "object",
    properties: {
      implementationStatus: { type: "string", enum: CONTROL_STATUSES },
      evidenceNotes: { type: "string", nullable: true },
    },
  },
  ModelCardUpdateInput: { type: "object", properties: { ...modelCardProperties, ...lockFields } },
  ModelCardMetricInput: {
    type: "object",
    properties: {
      metricName: { type: "string", minLength: 1 },
      metricValue: { type: "number" },
      slice: { type: "string", nullable: true },
      recordedAt: { type: "string", format: "date-time" },
    },
    required: ["metricName", "metricValue"],
  },
  UserCreateInput: {
    type: "object",
    properties: {
      email: { type: "string", format: "email" },
      name: { type: "string", minLength: 1 },
      role: { type: "string", enum: ROLES },
      password: { type: "string", minLength: 8 },
    },
    required: ["email", "name", "role", "password"],
  },
  UserUpdateInput: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      role: { type: "string", enum: ROLES },
      active: { type: "boolean" },
      password: { type: "string", minLength: 8 },
    },
  },
  CycloneDxExportInput: {
    type: "object",
    properties: {
      assetIds: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 500 },
    },
    required: ["assetIds"],
  },
};

const genericResponse = {
  description: "See the running app for the exact response shape.",
  content: { "application/json": { schema: {} } },
};
const errorResponse = {
  description: "Error envelope",
  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
};

function buildOperation(entry: RouteEntry) {
  const key = `${entry.method.toUpperCase()} ${entry.path}`;
  const bodySchemaName = REQUEST_BODY_SCHEMAS[key];
  const hasBody = ["post", "put", "patch"].includes(entry.method) && bodySchemaName !== undefined;
  return {
    tags: [tagFor(entry.path)],
    summary: key,
    ...(entry.requiresAuth ? { security: [{ bearerAuth: [] }] } : {}),
    ...(entry.roles ? { description: `Requires role: ${entry.roles.join(", ")}.` } : {}),
    ...(hasBody
      ? {
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: { $ref: `#/components/schemas/${bodySchemaName}` } },
            },
          },
        }
      : {}),
    responses: {
      ...(entry.method === "delete"
        ? { "204": { description: "No content" } }
        : { "200": genericResponse }),
      ...(entry.requiresAuth ? { "401": errorResponse } : {}),
      ...(entry.roles ? { "403": errorResponse } : {}),
      "422": errorResponse,
    },
  };
}

/** Builds the OpenAPI 3.0 document for the mounted /api/v1 router. */
export function buildOpenApiDocument(apiV1Router: Router) {
  const routes = collectRoutes(apiV1Router);
  const paths: Record<string, Record<string, unknown>> = {};
  for (const entry of routes) {
    const path = toOpenApiPath(entry.path);
    paths[path] ??= {};
    paths[path][entry.method] = buildOperation(entry);
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "AI Asset Governance API",
      version: "1",
      description:
        "AI-BOM / AI asset governance API. Path list is generated from the mounted routes; request bodies for the primary write endpoints are typed, others are generic.",
    },
    servers: [{ url: "/api/v1" }],
    tags: Object.values(TAG_BY_SEGMENT)
      .filter((tag, i, all) => all.indexOf(tag) === i)
      .map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      schemas,
    },
  };
}

/**
 * Mounts the OpenAPI JSON document and Swagger UI outside the versioned
 * /api/v1 prefix (they document the API, they aren't an API operation).
 * Gated behind ENABLE_API_DOCS: on by default outside production, opt-in
 * in production.
 */
export function mountApiDocs(app: Express, apiV1Router: Router): void {
  if (!apiDocsEnabled()) return;
  const document = buildOpenApiDocument(apiV1Router);
  app.get("/api/docs/openapi.json", (_req, res) => res.json(document));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(document));
}

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AIAsset, Control, ModelCard, ModelCardMetric, Risk } from "@prisma/client";

const require = createRequire(import.meta.url);
const Ajv = require("ajv");
const addFormats = require("ajv-formats");

const schemaUrl = "https://raw.githubusercontent.com/CycloneDX/specification/master/schema/bom-1.7.schema.json";
const schemaBaseUrl = "https://raw.githubusercontent.com/CycloneDX/specification/master/schema/";
const vendorDir = join(dirname(fileURLToPath(import.meta.url)), "..", "vendor");

type AssetForBom = AIAsset & {
  risks: Array<Risk & { controls: Array<Control & { implementationStatus: string; evidenceNotes: string | null }> }>;
  modelCard?: (ModelCard & { metrics?: ModelCardMetric[] }) | null;
};

type CycloneDxProperty = {
  name: string;
  value: string;
};

let validateBom: Awaited<ReturnType<typeof loadValidator>> | undefined;

function compactProperties(properties: Array<CycloneDxProperty | undefined>) {
  return properties.filter((property): property is CycloneDxProperty => Boolean(property));
}

function optionalProperty(name: string, value: string | null | undefined) {
  return value ? { name, value } : undefined;
}

function componentType(asset: AIAsset) {
  if (asset.type === "DATASET") return "data";
  if (asset.type === "LIBRARY") return "library";
  return "machine-learning-model";
}

function assetProperties(asset: AssetForBom) {
  const riskProperties = asset.risks.flatMap((risk) => [
    { name: "aibom:risk:id", value: risk.id },
    { name: "aibom:risk:framework", value: risk.sourceFramework },
    { name: "aibom:risk:category", value: risk.sourceCategoryId },
    { name: "aibom:risk:status", value: risk.status },
    { name: "aibom:risk:inherentScore", value: String(risk.inherentRiskScore) },
    optionalProperty("aibom:risk:residualScore", risk.residualRiskScore?.toString()),
    optionalProperty("aibom:risk:euAiActTier", risk.euAiActRiskTier),
    optionalProperty("aibom:risk:owner", risk.owner),
    optionalProperty("aibom:risk:treatmentPlan", risk.treatmentPlan),
    ...risk.controls.flatMap((control) => [
      { name: "aibom:control:id", value: control.id },
      { name: "aibom:control:riskId", value: risk.id },
      { name: "aibom:control:framework", value: control.mappedFramework },
      { name: "aibom:control:controlId", value: control.mappedControlId },
      { name: "aibom:control:status", value: control.implementationStatus },
      optionalProperty("aibom:control:evidenceNotes", control.evidenceNotes),
    ]),
  ]);

  return compactProperties([
    { name: "aibom:asset:id", value: asset.id },
    { name: "aibom:asset:type", value: asset.type },
    { name: "aibom:asset:hostingModel", value: asset.hostingModel },
    { name: "aibom:asset:status", value: asset.status },
    optionalProperty("aibom:asset:provider", asset.provider),
    optionalProperty("aibom:asset:dataClassificationTouched", asset.dataClassificationTouched),
    optionalProperty("aibom:asset:trainingDataProvenance", asset.trainingDataProvenance),
    optionalProperty("aibom:asset:downstreamConsumers", asset.downstreamConsumers),
    ...riskProperties,
  ]);
}

function asList(value: string | null | undefined) {
  return value ? [value] : undefined;
}

function optionalObject<T extends Record<string, unknown>>(value: T) {
  return Object.keys(value).length ? value : undefined;
}

function sourceExternalReferences(asset: AssetForBom) {
  return asset.sourceUrl ? [{ type: "website", url: asset.sourceUrl }] : undefined;
}

function performanceMetrics(metrics: ModelCardMetric[] | undefined) {
  const mappedMetrics = (metrics ?? []).map((metric) => ({
    type: metric.metricName,
    value: String(metric.metricValue),
    ...(metric.slice ? { slice: metric.slice } : {}),
  }));

  return mappedMetrics.length ? mappedMetrics : undefined;
}

function modelCardForCycloneDx(asset: AssetForBom) {
  const card = asset.modelCard;
  if (!card) return undefined;

  const modelParameters = optionalObject({
    ...(card.task ? { task: card.task } : {}),
    ...(card.architectureFamily ? { architectureFamily: card.architectureFamily } : {}),
    ...(card.modelArchitecture ? { modelArchitecture: card.modelArchitecture } : {}),
    ...(card.inputsDescription ? { inputs: [{ format: card.inputsDescription }] } : {}),
    ...(card.outputsDescription ? { outputs: [{ format: card.outputsDescription }] } : {}),
  });
  const quantitativeAnalysis = optionalObject({
    ...(performanceMetrics(card.metrics) ? { performanceMetrics: performanceMetrics(card.metrics) } : {}),
  });
  const considerations = optionalObject({
    ...(asList(card.intendedUsers) ? { users: asList(card.intendedUsers) } : {}),
    ...(asList(card.useCases) ? { useCases: asList(card.useCases) } : {}),
    ...(asList(card.technicalLimitations) ? { technicalLimitations: asList(card.technicalLimitations) } : {}),
    ...(asList(card.performanceTradeoffs) ? { performanceTradeoffs: asList(card.performanceTradeoffs) } : {}),
    ...(card.ethicalConsiderations ? { ethicalConsiderations: [{ name: card.ethicalConsiderations }] } : {}),
    ...(card.fairnessAssessments ? { fairnessAssessments: [{ groupAtRisk: card.fairnessAssessments }] } : {}),
  });

  return optionalObject({
    "bom-ref": `model-card:${card.id}`,
    ...(modelParameters ? { modelParameters } : {}),
    ...(quantitativeAnalysis ? { quantitativeAnalysis } : {}),
    ...(considerations ? { considerations } : {}),
    properties: compactProperties([
      optionalProperty("aibom:modelCard:approach", card.approach),
      optionalProperty("aibom:modelCard:datasetsDescription", card.datasetsDescription),
      optionalProperty("aibom:modelCard:environmentalConsiderations", card.environmentalConsiderations),
    ]),
  });
}

function mapComponent(asset: AssetForBom) {
  return {
    type: componentType(asset),
    "bom-ref": `asset:${asset.id}`,
    name: asset.name,
    version: asset.version,
    supplier: { name: asset.supplier },
    ...(asset.license ? { licenses: [{ license: { name: asset.license } }] } : {}),
    ...(sourceExternalReferences(asset) ? { externalReferences: sourceExternalReferences(asset) } : {}),
    ...(modelCardForCycloneDx(asset) ? { modelCard: modelCardForCycloneDx(asset) } : {}),
    properties: assetProperties(asset),
  };
}

function mapService(asset: AssetForBom) {
  return {
    "bom-ref": `asset:${asset.id}`,
    name: asset.name,
    version: asset.version,
    provider: { name: asset.provider ?? asset.supplier },
    ...(sourceExternalReferences(asset) ? { externalReferences: sourceExternalReferences(asset) } : {}),
    properties: assetProperties(asset),
  };
}

export function buildCycloneDxBom(assets: AssetForBom[]) {
  const componentAssets = assets.filter((asset) => asset.type !== "SERVICE");
  const serviceAssets = assets.filter((asset) => asset.type === "SERVICE");

  return {
    "$schema": "http://cyclonedx.org/schema/bom-1.7.schema.json",
    bomFormat: "CycloneDX",
    specVersion: "1.7",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: {
        components: [
          {
            type: "application",
            name: "AI Asset Governance Tool",
            version: "0.1.0",
          },
        ],
      },
      lifecycles: [{ phase: "operations" }],
      properties: [
        { name: "aibom:export:source", value: "manual-grc-intake" },
        { name: "aibom:export:assetCount", value: String(assets.length) },
      ],
    },
    ...(componentAssets.length ? { components: componentAssets.map(mapComponent) } : {}),
    ...(serviceAssets.length ? { services: serviceAssets.map(mapService) } : {}),
  };
}

async function loadValidator() {
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  addFormats(ajv);
  const rootSchema = await loadSchemaFile("bom-1.7.schema.json");
  const referencedSchemas = await fetchReferencedSchemas(rootSchema);

  for (const schema of referencedSchemas) {
    ajv.addSchema(schema);
  }

  return ajv.compile(rootSchema);
}

async function fetchJsonSchema(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Unable to fetch CycloneDX schema ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function loadSchemaFile(fileName: string) {
  const filePath = join(vendorDir, fileName);

  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    const schema = await fetchJsonSchema(`${schemaBaseUrl}${fileName}`);
    await mkdir(vendorDir, { recursive: true });
    await writeFile(filePath, JSON.stringify(schema, null, 2));
    return schema;
  }
}

async function fetchReferencedSchemas(rootSchema: unknown) {
  const schemas = new Map<string, unknown>();
  const pending = collectExternalRefs(rootSchema);

  while (pending.length) {
    const uri = normalizeSchemaUri(pending.pop()!);
    if (schemas.has(uri)) continue;

    const schema = await loadSchemaFile(resolveSchemaFileName(uri));
    schemas.set(uri, schema);

    for (const nestedRef of collectExternalRefs(schema)) {
      const normalizedNestedRef = normalizeSchemaUri(nestedRef);
      if (!schemas.has(normalizedNestedRef)) pending.push(normalizedNestedRef);
    }
  }

  return [...schemas.values()];
}

function collectExternalRefs(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    return value.flatMap(collectExternalRefs);
  }

  return Object.entries(value).flatMap(([key, entry]) => {
    if (key === "$ref" && typeof entry === "string" && !entry.startsWith("#")) {
      return [entry];
    }

    return collectExternalRefs(entry);
  });
}

function resolveSchemaFileName(uri: string) {
  const fileName = normalizeSchemaUri(uri).split("/").pop();

  if (!fileName) {
    throw new Error(`Unsupported CycloneDX schema reference: ${uri}`);
  }

  return fileName;
}

function normalizeSchemaUri(uri: string) {
  return uri.split("#")[0] ?? uri;
}

export async function validateCycloneDxBom(bom: unknown) {
  validateBom ??= await loadValidator();
  const valid = validateBom(bom);

  return {
    valid,
    errors: valid ? [] : validateBom.errors ?? [],
    schemaUrl,
  };
}

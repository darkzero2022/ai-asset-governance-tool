import { buildCycloneDxBom, validateCycloneDxBom } from "../src/cyclonedx.js";

const asset = {
  id: "asset-self-test",
  name: "Self-Test Model",
  version: "1.0.0",
  type: "MODEL",
  supplier: "Internal",
  provider: null,
  hostingModel: "SELF_HOSTED",
  license: "Proprietary",
  dataClassificationTouched: "PII",
  trainingDataProvenance: "Internal validation fixture.",
  downstreamConsumers: "Validation script",
  status: "DRAFT",
  createdById: "self-test-user",
  createdAt: new Date(),
  updatedAt: new Date(),
  risks: [],
} satisfies Parameters<typeof buildCycloneDxBom>[0][number];

const bom = buildCycloneDxBom([asset]);
const validation = await validateCycloneDxBom(bom);

if (!validation.valid) {
  console.error(JSON.stringify(validation.errors, null, 2));
  process.exit(1);
}

console.log(`CycloneDX BOM validated against ${validation.schemaUrl}`);

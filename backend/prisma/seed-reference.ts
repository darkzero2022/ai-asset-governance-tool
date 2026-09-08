import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// The initial admin login/name come from the environment (set by scripts/setup.sh),
// falling back to the documented defaults.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || "admin@example.com";
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || "Admin User";

async function seedAdminUser() {
  const envPassword = process.env.ADMIN_PASSWORD?.trim() || undefined;
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    // Never silently reset a password that may have been changed in the UI.
    // Only reset it when an explicit ADMIN_PASSWORD is provided (recovery path).
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data: {
        role: "ADMIN",
        active: true,
        ...(process.env.ADMIN_NAME ? { name: ADMIN_NAME } : {}),
        ...(envPassword ? { passwordHash: await bcrypt.hash(envPassword, 10) } : {}),
      },
    });
    if (envPassword) console.log(`\n  Reset password for ${ADMIN_EMAIL} from ADMIN_PASSWORD.\n`);
    return;
  }

  // No ADMIN_PASSWORD and no existing admin: leave the account to be created
  // through the app's first-run screen. (setup.sh supplies a password for
  // --data=demo, which needs an owner.)
  if (!envPassword) {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log("\n  No admin account seeded — open the app and create one on first visit.\n");
    }
    return;
  }

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "ADMIN",
      active: true,
      passwordHash: await bcrypt.hash(envPassword, 10),
    },
  });

  console.log("\n  ────────────────────────────────────────────────");
  console.log("  Created initial admin account");
  console.log(`    Email:    ${ADMIN_EMAIL}`);
  console.log(`    Password: (the value you supplied)`);
  console.log("  Sign in, then change this password on the Users page.");
  console.log("  ────────────────────────────────────────────────\n");
}

export async function seedReferenceData() {
  await seedAdminUser();

  const frameworkCategories = [
    { framework: "NIST_AI_RMF", categoryId: "GOVERN", name: "Govern", description: "Policies, processes, procedures, and practices across AI risk management." },
    { framework: "NIST_AI_RMF", categoryId: "MAP", name: "Map", description: "Context is recognized and risks related to context are identified." },
    { framework: "NIST_AI_RMF", categoryId: "MEASURE", name: "Measure", description: "Identified AI risks are assessed, analyzed, or tracked." },
    { framework: "NIST_AI_RMF", categoryId: "MANAGE", name: "Manage", description: "AI risks are prioritized, responded to, and monitored." },
    { framework: "EU_AI_ACT", categoryId: "UNACCEPTABLE", name: "Unacceptable Risk", description: "AI systems considered a clear threat to safety, livelihood, or rights." },
    { framework: "EU_AI_ACT", categoryId: "HIGH", name: "High Risk", description: "AI systems subject to strict risk management, data, documentation, and oversight obligations." },
    { framework: "EU_AI_ACT", categoryId: "LIMITED", name: "Limited Risk", description: "AI systems primarily subject to transparency obligations." },
    { framework: "EU_AI_ACT", categoryId: "MINIMAL", name: "Minimal Risk", description: "AI systems with minimal or no specific obligations under the risk framework." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM01", name: "Prompt Injection", description: "User input manipulates model behavior or bypasses intended controls." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM02", name: "Sensitive Information Disclosure", description: "The system exposes confidential or sensitive data through model output or logs." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM03", name: "Supply Chain", description: "Risks introduced by third-party models, datasets, plugins, or dependencies." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM04", name: "Data and Model Poisoning", description: "Training, fine-tuning, or retrieval data is manipulated to affect behavior." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM05", name: "Improper Output Handling", description: "Generated output is trusted without adequate validation or sanitization." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM06", name: "Excessive Agency", description: "The system can perform actions beyond intended authority or guardrails." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM07", name: "System Prompt Leakage", description: "System prompts or hidden instructions are exposed to users or attackers." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM08", name: "Vector and Embedding Weaknesses", description: "Retrieval or embedding weaknesses affect confidentiality, integrity, or relevance." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM09", name: "Misinformation", description: "Incorrect, fabricated, or misleading model output creates operational risk." },
    { framework: "OWASP_LLM_TOP10", categoryId: "LLM10", name: "Unbounded Consumption", description: "Resource abuse causes excessive cost, degraded service, or denial of service." },
  ] as const;

  for (const category of frameworkCategories) {
    await prisma.frameworkCategory.upsert({
      where: { framework_categoryId: { framework: category.framework, categoryId: category.categoryId } },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  const tiers = [
    { tier: "UNACCEPTABLE", name: "Unacceptable", description: "Prohibited AI practices due to unacceptable risk." },
    { tier: "HIGH", name: "High", description: "High-risk AI systems requiring risk management and compliance controls." },
    { tier: "LIMITED", name: "Limited", description: "AI systems requiring transparency obligations." },
    { tier: "MINIMAL", name: "Minimal", description: "AI systems with minimal regulatory obligations." },
  ] as const;

  for (const tier of tiers) {
    await prisma.euAiActRiskTierReference.upsert({
      where: { tier: tier.tier },
      update: { name: tier.name, description: tier.description },
      create: tier,
    });
  }

  // Canonical MITRE ATLAS technique names offered for Risk.atlasTechnique.
  const atlasTechniques = [
    "LLM Prompt Injection",
    "Exfiltration via Inference API",
    "ML Supply Chain Compromise",
    "Data Poisoning",
    "Downstream Execution of Unvalidated Output",
    "Exfiltration via AI Agent Tool Invocation",
    "Discovery: LLM System Prompt",
    "RAG Poisoning / False RAG Entry Injection",
    "Sponge Example / Context Flooding",
  ] as const;

  for (const name of atlasTechniques) {
    await prisma.atlasTechniqueReference.upsert({ where: { name }, update: {}, create: { name } });
  }

  // Canonical MITRE ATLAS mitigations offered for Risk.atlasMitigations — the
  // remediation-plan counterpart of the techniques above. Source: MITRE ATLAS
  // mitigations catalogue (AML.M0000–AML.M0022).
  const atlasMitigations = [
    "AML.M0000 — Limit Public Release of Information",
    "AML.M0001 — Limit Model Artifact Release",
    "AML.M0002 — Passive ML Output Obfuscation",
    "AML.M0003 — Model Hardening",
    "AML.M0004 — Restrict Number of ML Model Queries",
    "AML.M0005 — Control Access to ML Models and Data at Rest",
    "AML.M0006 — Use Ensemble Methods",
    "AML.M0007 — Sanitize Training Data",
    "AML.M0008 — Validate ML Model",
    "AML.M0009 — Use Multi-Modal Sensors",
    "AML.M0010 — Input Restoration",
    "AML.M0011 — Restrict Library Loading",
    "AML.M0012 — Encrypt Sensitive Information",
    "AML.M0013 — Code Signing",
    "AML.M0014 — Verify ML Artifacts",
    "AML.M0015 — Adversarial Input Detection",
    "AML.M0016 — Vulnerability Scanning",
    "AML.M0017 — Model Distribution Methods",
    "AML.M0018 — User Training",
    "AML.M0019 — Control Access to ML Models and Data in Production",
    "AML.M0020 — Generative AI Guardrails",
    "AML.M0021 — Generative AI Guidelines",
    "AML.M0022 — Generative AI Model Alignment",
  ] as const;

  for (const name of atlasMitigations) {
    await prisma.atlasMitigationReference.upsert({ where: { name }, update: {}, create: { name } });
  }

  // OWASP LLM Top 10 -> STRIDE-AI category + ATLAS technique lookup. Auto-populates
  // an OWASP-linked risk's STRIDE-AI / ATLAS fields; both stay editable afterwards.
  const strideAtlasMappings = [
    { owaspCategoryId: "LLM01", strideAiCategory: "ALIGNMENT_BYPASS", atlasTechnique: "LLM Prompt Injection" },
    { owaspCategoryId: "LLM02", strideAiCategory: "MODEL_INVERSION", atlasTechnique: "Exfiltration via Inference API" },
    { owaspCategoryId: "LLM03", strideAiCategory: "MODEL_IMPERSONATION", atlasTechnique: "ML Supply Chain Compromise" },
    { owaspCategoryId: "LLM04", strideAiCategory: "DATA_MODEL_POISONING", atlasTechnique: "Data Poisoning" },
    { owaspCategoryId: "LLM05", strideAiCategory: "ALIGNMENT_BYPASS", atlasTechnique: "Downstream Execution of Unvalidated Output" },
    { owaspCategoryId: "LLM06", strideAiCategory: "ALIGNMENT_BYPASS", atlasTechnique: "Exfiltration via AI Agent Tool Invocation" },
    { owaspCategoryId: "LLM07", strideAiCategory: "PROVENANCE_LOSS", atlasTechnique: "Discovery: LLM System Prompt" },
    { owaspCategoryId: "LLM08", strideAiCategory: "DATA_MODEL_POISONING", atlasTechnique: "RAG Poisoning / False RAG Entry Injection" },
    { owaspCategoryId: "LLM09", strideAiCategory: "MODEL_INVERSION", atlasTechnique: null },
    { owaspCategoryId: "LLM10", strideAiCategory: "RESOURCE_EXHAUSTION", atlasTechnique: "Sponge Example / Context Flooding" },
  ] as const;

  for (const mapping of strideAtlasMappings) {
    await prisma.strideAtlasMapping.upsert({
      where: { owaspCategoryId: mapping.owaspCategoryId },
      update: { strideAiCategory: mapping.strideAiCategory, atlasTechnique: mapping.atlasTechnique },
      create: mapping,
    });
  }
}

seedReferenceData()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });

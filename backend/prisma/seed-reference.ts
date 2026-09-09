import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { passwordSchema } from "@aibom/shared";

const prisma = new PrismaClient();

// The initial admin login/name come from the environment (set by scripts/setup.sh),
// falling back to the documented defaults.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.trim() || "admin@example.com";
const ADMIN_NAME = process.env.ADMIN_NAME?.trim() || "Admin User";

async function seedAdminUser() {
  const envPassword = process.env.ADMIN_PASSWORD?.trim() || undefined;

  // Any path that sets an admin password (setup, manual seed, recovery re-run)
  // must satisfy the same policy the app enforces on password changes.
  if (envPassword) {
    const check = passwordSchema.safeParse(envPassword);
    if (!check.success) {
      console.error(
        `\n  ADMIN_PASSWORD rejected: ${check.error.issues[0]?.message ?? "weak password"}.`,
      );
      console.error("  Use at least 12 characters and avoid common/breached passwords.\n");
      process.exit(1);
    }
  }
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
  console.log("  Sign in, then change this password on the Account page.");
  console.log("  ────────────────────────────────────────────────\n");
}

export async function seedReferenceData() {
  await seedAdminUser();

  const frameworkCategories = [
    {
      framework: "NIST_AI_RMF",
      categoryId: "GOVERN",
      name: "Govern",
      description: "Policies, processes, procedures, and practices across AI risk management.",
    },
    {
      framework: "NIST_AI_RMF",
      categoryId: "MAP",
      name: "Map",
      description: "Context is recognized and risks related to context are identified.",
    },
    {
      framework: "NIST_AI_RMF",
      categoryId: "MEASURE",
      name: "Measure",
      description: "Identified AI risks are assessed, analyzed, or tracked.",
    },
    {
      framework: "NIST_AI_RMF",
      categoryId: "MANAGE",
      name: "Manage",
      description: "AI risks are prioritized, responded to, and monitored.",
    },
    {
      framework: "EU_AI_ACT",
      categoryId: "UNACCEPTABLE",
      name: "Unacceptable Risk",
      description: "AI systems considered a clear threat to safety, livelihood, or rights.",
    },
    {
      framework: "EU_AI_ACT",
      categoryId: "HIGH",
      name: "High Risk",
      description:
        "AI systems subject to strict risk management, data, documentation, and oversight obligations.",
    },
    {
      framework: "EU_AI_ACT",
      categoryId: "LIMITED",
      name: "Limited Risk",
      description: "AI systems primarily subject to transparency obligations.",
    },
    {
      framework: "EU_AI_ACT",
      categoryId: "MINIMAL",
      name: "Minimal Risk",
      description: "AI systems with minimal or no specific obligations under the risk framework.",
    },
    // OWASP Top 10 for LLM Applications (2025). `name` is the published category
    // title (a factual identifier used for cross-framework mapping); every
    // `description` below is this project's own one-line summary, not text from
    // the OWASP document. Attribution + licence: NOTICE / ATTRIBUTION.md.
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM01",
      name: "Prompt Injection",
      description: "User input manipulates model behavior or bypasses intended controls.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM02",
      name: "Sensitive Information Disclosure",
      description:
        "The system exposes confidential or sensitive data through model output or logs.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM03",
      name: "Supply Chain",
      description: "Risks introduced by third-party models, datasets, plugins, or dependencies.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM04",
      name: "Data and Model Poisoning",
      description: "Training, fine-tuning, or retrieval data is manipulated to affect behavior.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM05",
      name: "Improper Output Handling",
      description: "Generated output is trusted without adequate validation or sanitization.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM06",
      name: "Excessive Agency",
      description: "The system can perform actions beyond intended authority or guardrails.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM07",
      name: "System Prompt Leakage",
      description: "System prompts or hidden instructions are exposed to users or attackers.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM08",
      name: "Vector and Embedding Weaknesses",
      description:
        "Retrieval or embedding weaknesses affect confidentiality, integrity, or relevance.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM09",
      name: "Misinformation",
      description: "Incorrect, fabricated, or misleading model output creates operational risk.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM10",
      name: "Unbounded Consumption",
      description: "Resource abuse causes excessive cost, degraded service, or denial of service.",
    },
    // OWASP Top 10 for MCP (Model Context Protocol) — draft (2025),
    // https://github.com/OWASP/www-project-mcp-top-10. That document is
    // CC BY-NC-SA 4.0 (non-commercial); it is NOT redistributed here. `name` is
    // the published category title (a factual identifier for cross-framework
    // mapping) and each `description` is this project's own one-line summary.
    // Attribution + licence note: NOTICE / ATTRIBUTION.md.
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP01",
      name: "Token Mismanagement & Secret Exposure",
      description:
        "Credentials or tokens exposed in context, memory, or logs enable unauthorized access to connected systems.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP02",
      name: "Privilege Escalation via Scope Creep",
      description:
        "Loosely-scoped tool or connector permissions widen over time, letting an actor perform actions beyond intent.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP03",
      name: "Tool Poisoning",
      description:
        "A compromised or malicious tool/server injects misleading context to manipulate the model's decisions.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP04",
      name: "Software Supply Chain Attacks & Dependency Tampering",
      description:
        "Compromised MCP server dependencies introduce backdoors or alter agent behaviour at runtime.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP05",
      name: "Command Injection & Execution",
      description:
        "Untrusted input reaches system commands, scripts, or API calls an agent executes without validation.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP06",
      name: "Prompt Injection via Contextual Payloads",
      description:
        "Natural-language payloads delivered through tool output or resources subvert the model's instructions.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP07",
      name: "Insufficient Authentication & Authorization",
      description:
        "Weak identity verification and access control between agents, clients, and MCP servers create attack paths.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP08",
      name: "Lack of Audit and Telemetry",
      description:
        "Limited logging of tool invocations and context changes impedes detection and incident response.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP09",
      name: "Shadow MCP Servers",
      description:
        "Unapproved MCP deployments run outside governance with default credentials and permissive configs.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP10",
      name: "Context Injection & Over-Sharing",
      description:
        "Shared or persistent context windows leak sensitive data across tasks, users, or agents.",
    },
  ] as const;

  for (const category of frameworkCategories) {
    await prisma.frameworkCategory.upsert({
      where: {
        framework_categoryId: { framework: category.framework, categoryId: category.categoryId },
      },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  const tiers = [
    {
      tier: "UNACCEPTABLE",
      name: "Unacceptable",
      description: "Prohibited AI practices due to unacceptable risk.",
    },
    {
      tier: "HIGH",
      name: "High",
      description: "High-risk AI systems requiring risk management and compliance controls.",
    },
    {
      tier: "LIMITED",
      name: "Limited",
      description: "AI systems requiring transparency obligations.",
    },
    {
      tier: "MINIMAL",
      name: "Minimal",
      description: "AI systems with minimal regulatory obligations.",
    },
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
    // Added for OWASP MCP Top 10 coverage.
    "LLM Plugin Compromise",
    "Unsecured Credentials",
    "Valid Accounts",
    "Masquerading",
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

  // Short-id -> full "AML.Mxxxx — Title" so the mappings below stay readable.
  const M = (id: string) => atlasMitigations.find((name) => name.startsWith(`AML.M${id} `))!;

  // Framework category -> STRIDE-AI + ATLAS technique(s) + suggested ATLAS
  // mitigation(s). Auto-populates a linked risk's fields; every value is a
  // default the risk can override or clear. STRIDE-AI is a model-centric
  // taxonomy, so several MCP (infrastructure/agent) entries are a closest-fit
  // approximation rather than an exact match — noted per row.
  const frameworkThreatMappings = [
    // OWASP LLM Top 10 (2025)
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM01",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["LLM Prompt Injection"],
      atlasMitigations: [M("0020"), M("0015")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM02",
      strideAiCategory: "MODEL_INVERSION",
      atlasTechniques: ["Exfiltration via Inference API"],
      atlasMitigations: [M("0012"), M("0000"), M("0019")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM03",
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechniques: ["ML Supply Chain Compromise"],
      atlasMitigations: [M("0013"), M("0014"), M("0016")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM04",
      strideAiCategory: "DATA_MODEL_POISONING",
      atlasTechniques: ["Data Poisoning"],
      atlasMitigations: [M("0007"), M("0008")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM05",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["Downstream Execution of Unvalidated Output"],
      atlasMitigations: [M("0015"), M("0020")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM06",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["Exfiltration via AI Agent Tool Invocation"],
      atlasMitigations: [M("0019"), M("0020")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM07",
      strideAiCategory: "PROVENANCE_LOSS",
      atlasTechniques: ["Discovery: LLM System Prompt"],
      atlasMitigations: [M("0000"), M("0019")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM08",
      strideAiCategory: "DATA_MODEL_POISONING",
      atlasTechniques: ["RAG Poisoning / False RAG Entry Injection"],
      atlasMitigations: [M("0007"), M("0019")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM09",
      strideAiCategory: "MODEL_INVERSION",
      atlasTechniques: [],
      atlasMitigations: [M("0021"), M("0022")],
    },
    {
      framework: "OWASP_LLM_TOP10",
      categoryId: "LLM10",
      strideAiCategory: "RESOURCE_EXHAUSTION",
      atlasTechniques: ["Sponge Example / Context Flooding"],
      atlasMitigations: [M("0004")],
    },
    // OWASP MCP Top 10 (draft v0.1) — STRIDE-AI is closest-fit for MCP01/02/05/07/08/09.
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP01",
      strideAiCategory: "PROVENANCE_LOSS",
      atlasTechniques: ["Unsecured Credentials"],
      atlasMitigations: [M("0012"), M("0005")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP02",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["Exfiltration via AI Agent Tool Invocation"],
      atlasMitigations: [M("0019"), M("0015")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP03",
      strideAiCategory: "DATA_MODEL_POISONING",
      atlasTechniques: ["LLM Plugin Compromise"],
      atlasMitigations: [M("0014"), M("0013")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP04",
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechniques: ["ML Supply Chain Compromise"],
      atlasMitigations: [M("0013"), M("0014"), M("0016")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP05",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["Downstream Execution of Unvalidated Output"],
      atlasMitigations: [M("0015"), M("0020")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP06",
      strideAiCategory: "ALIGNMENT_BYPASS",
      atlasTechniques: ["LLM Prompt Injection"],
      atlasMitigations: [M("0020"), M("0015")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP07",
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechniques: ["Valid Accounts"],
      atlasMitigations: [M("0019"), M("0005")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP08",
      strideAiCategory: "PROVENANCE_LOSS",
      atlasTechniques: [],
      atlasMitigations: [M("0019")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP09",
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechniques: ["Masquerading"],
      atlasMitigations: [M("0019"), M("0016")],
    },
    {
      framework: "OWASP_MCP_TOP10",
      categoryId: "MCP10",
      strideAiCategory: "MODEL_INVERSION",
      atlasTechniques: ["RAG Poisoning / False RAG Entry Injection"],
      atlasMitigations: [M("0020"), M("0012")],
    },
  ] as const;

  for (const mapping of frameworkThreatMappings) {
    const data = {
      strideAiCategory: mapping.strideAiCategory,
      atlasTechniques: [...mapping.atlasTechniques],
      atlasMitigations: [...mapping.atlasMitigations],
    };
    await prisma.frameworkThreatMapping.upsert({
      where: {
        framework_categoryId: { framework: mapping.framework, categoryId: mapping.categoryId },
      },
      update: data,
      create: { framework: mapping.framework, categoryId: mapping.categoryId, ...data },
    });
  }

  // Cross-framework relationships. OWASP publishes no official crosswalk; these
  // are our analysis (rationale recorded) and are stored in both directions.
  const crosswalkSeeds = [
    {
      from: ["OWASP_MCP_TOP10", "MCP06"],
      to: ["OWASP_LLM_TOP10", "LLM01"],
      relationship: "EQUIVALENT",
      rationale:
        "Both are prompt injection; MCP06 is the same class delivered through tool output / MCP resources.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP03"],
      to: ["OWASP_LLM_TOP10", "LLM03"],
      relationship: "RELATED",
      rationale:
        "A poisoned tool is a compromised third-party component in the model's supply chain.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP04"],
      to: ["OWASP_LLM_TOP10", "LLM03"],
      relationship: "RELATED",
      rationale: "MCP server dependency tampering is a supply-chain compromise.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP01"],
      to: ["OWASP_LLM_TOP10", "LLM02"],
      relationship: "RELATED",
      rationale:
        "Leaked tokens/secrets are sensitive information disclosed through context, memory, or logs.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP10"],
      to: ["OWASP_LLM_TOP10", "LLM02"],
      relationship: "RELATED",
      rationale: "Over-shared context windows disclose sensitive information across tasks/users.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP10"],
      to: ["OWASP_LLM_TOP10", "LLM08"],
      relationship: "RELATED",
      rationale: "Persistent/shared retrieval context is a vector & embedding weakness.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP02"],
      to: ["OWASP_LLM_TOP10", "LLM06"],
      relationship: "RELATED",
      rationale: "Scope creep on tool permissions is excessive agency.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP05"],
      to: ["OWASP_LLM_TOP10", "LLM05"],
      relationship: "RELATED",
      rationale: "Command injection stems from executing unvalidated model/tool output.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP08"],
      to: ["NIST_AI_RMF", "MANAGE"],
      relationship: "RELATED",
      rationale: "Audit & telemetry gaps are a failure to monitor and respond (NIST MANAGE).",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP08"],
      to: ["NIST_AI_RMF", "GOVERN"],
      relationship: "RELATED",
      rationale: "Logging/accountability of AI tooling is a governance control.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP07"],
      to: ["NIST_AI_RMF", "MAP"],
      relationship: "RELATED",
      rationale:
        "Identifying trust boundaries and access requirements between agents/servers is a MAP activity.",
    },
    {
      from: ["OWASP_MCP_TOP10", "MCP09"],
      to: ["NIST_AI_RMF", "MAP"],
      relationship: "RELATED",
      rationale: "Discovering unsanctioned MCP deployments is context/inventory mapping.",
    },
  ] as const;

  const reverseRelationship = (r: string) =>
    r === "BROADER" ? "NARROWER" : r === "NARROWER" ? "BROADER" : r;
  const crosswalkRows = crosswalkSeeds.flatMap((seed) => [
    {
      fromFramework: seed.from[0],
      fromCategoryId: seed.from[1],
      toFramework: seed.to[0],
      toCategoryId: seed.to[1],
      relationship: seed.relationship,
      rationale: seed.rationale,
    },
    {
      fromFramework: seed.to[0],
      fromCategoryId: seed.to[1],
      toFramework: seed.from[0],
      toCategoryId: seed.from[1],
      relationship: reverseRelationship(seed.relationship),
      rationale: seed.rationale,
    },
  ]);

  for (const row of crosswalkRows) {
    await prisma.frameworkCrosswalk.upsert({
      where: {
        fromFramework_fromCategoryId_toFramework_toCategoryId: {
          fromFramework: row.fromFramework as never,
          fromCategoryId: row.fromCategoryId,
          toFramework: row.toFramework as never,
          toCategoryId: row.toCategoryId,
        },
      },
      update: { relationship: row.relationship as never, rationale: row.rationale },
      create: row as never,
    });
  }

  // Which revision/edition of each framework this build maps against, and whether
  // it is a draft. The UI badges drafts; CycloneDX/SPDX exports cite `revision`.
  const frameworkMeta = [
    {
      framework: "NIST_AI_RMF",
      title: "NIST AI Risk Management Framework",
      revision: "NIST AI 100-1 (Jan 2023)",
      status: "RELEASED",
      sourceUrl: "https://www.nist.gov/itl/ai-risk-management-framework",
      licenseNote: "U.S. Government work — not subject to copyright in the United States.",
    },
    {
      framework: "EU_AI_ACT",
      title: "EU Artificial Intelligence Act",
      revision: "Regulation (EU) 2024/1689",
      status: "RELEASED",
      sourceUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj",
      licenseNote:
        "© European Union, https://eur-lex.europa.eu — reuse authorised with acknowledgement.",
    },
    {
      framework: "OWASP_LLM_TOP10",
      title: "OWASP Top 10 for LLM Applications",
      revision: "2025",
      status: "RELEASED",
      sourceUrl: "https://genai.owasp.org/llm-top-10/",
      licenseNote: "OWASP — CC BY-SA 4.0.",
    },
    {
      framework: "OWASP_MCP_TOP10",
      title: "OWASP Top 10 for MCP (Model Context Protocol)",
      revision: "Draft v0.1 (2025)",
      status: "DRAFT",
      sourceUrl: "https://github.com/OWASP/www-project-mcp-top-10",
      licenseNote:
        "OWASP — CC BY-NC-SA 4.0 (non-commercial). Draft — categories and wording may change.",
    },
  ] as const;

  for (const meta of frameworkMeta) {
    await prisma.frameworkMeta.upsert({
      where: { framework: meta.framework },
      update: {
        title: meta.title,
        revision: meta.revision,
        status: meta.status,
        sourceUrl: meta.sourceUrl,
        licenseNote: meta.licenseNote,
      },
      create: meta,
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

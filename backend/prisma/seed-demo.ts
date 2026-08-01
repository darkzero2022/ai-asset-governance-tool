import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@example.com" } });

  const assets = [
    {
      id: "seed-asset-fraud-model",
      name: "Claims Fraud Model",
      version: "2.3.0",
      type: "MODEL",
      supplier: "Internal ML Platform",
      provider: "Risk Analytics",
      hostingModel: "SELF_HOSTED",
      networkDependency: "HYBRID",
      license: "Proprietary",
      dataClassificationTouched: "PII, claims history",
      trainingDataProvenance: "Historical claims from approved data mart",
      downstreamConsumers: "Claims review workflow, fraud investigation queue",
      status: "APPROVED",
    },
    {
      id: "seed-asset-underwriting-copilot",
      name: "Underwriting Copilot",
      version: "1.1.0",
      type: "SERVICE",
      supplier: "Internal AI Enablement",
      provider: "Azure OpenAI",
      hostingModel: "SAAS_API",
      networkDependency: "FULLY_CONNECTED",
      license: "Enterprise subscription",
      dataClassificationTouched: "Customer submissions, policy metadata",
      trainingDataProvenance: "Retrieval only; no model fine-tuning",
      downstreamConsumers: "Underwriter desktop",
      status: "UNDER_REVIEW",
    },
    {
      id: "seed-asset-customer-churn-model",
      name: "Customer Churn Model",
      version: "0.9.4",
      type: "MODEL",
      supplier: "Data Science Lab",
      provider: "Internal ML Platform",
      hostingModel: "EMBEDDED_IN_APP",
      networkDependency: "AIR_GAPPED",
      license: "Proprietary",
      dataClassificationTouched: "Customer profile aggregates",
      trainingDataProvenance: "CRM aggregates and retention outcomes",
      downstreamConsumers: "Marketing next-best-action pilot",
      status: "DRAFT",
    },
    {
      id: "seed-asset-policy-dataset",
      name: "Policy Documents Dataset",
      version: "2026.07",
      type: "DATASET",
      supplier: "Knowledge Operations",
      provider: "Enterprise Content Management",
      hostingModel: "SELF_HOSTED",
      networkDependency: "HYBRID",
      license: "Internal use only",
      dataClassificationTouched: "Policy documents, internal procedures",
      trainingDataProvenance: "Curated policy corpus with governance approvals",
      downstreamConsumers: "Underwriting Copilot, policy search",
      status: "DEPLOYED",
    },
    {
      id: "seed-asset-vector-library",
      name: "Embedding Utility Library",
      version: "3.2.1",
      type: "LIBRARY",
      supplier: "Platform Engineering",
      provider: "Internal package registry",
      hostingModel: "EMBEDDED_IN_APP",
      networkDependency: "AIR_GAPPED",
      license: "Apache-2.0",
      dataClassificationTouched: "None",
      trainingDataProvenance: "Not applicable",
      downstreamConsumers: "Retrieval services and model evaluation jobs",
      status: "RETIRED",
    },
    {
      id: "seed-asset-claims-triage-service",
      name: "Claims Triage Service",
      version: "1.5.2",
      type: "SERVICE",
      supplier: "Claims Automation",
      provider: "Internal Kubernetes Platform",
      hostingModel: "SELF_HOSTED",
      networkDependency: "FULLY_CONNECTED",
      license: "Proprietary",
      dataClassificationTouched: "Claims details, customer identifiers",
      trainingDataProvenance: "Uses Claims Fraud Model and policy dataset",
      downstreamConsumers: "Claims intake portal",
      status: "DEPLOYED",
    },
  ] as const;

  for (const asset of assets) {
    await prisma.aIAsset.upsert({
      where: { id: asset.id },
      update: asset,
      create: { ...asset, createdById: admin.id },
    });
  }

  const projects = [
    { id: "seed-project-claims-modernization", name: "Claims Modernization", description: "Automated claims intake and triage journey.", businessOwner: "Claims Operations", status: "ACTIVE" },
    { id: "seed-project-underwriting-workbench", name: "Underwriting Workbench", description: "AI-assisted underwriting research and drafting.", businessOwner: "Commercial Underwriting", status: "ACTIVE" },
    { id: "seed-project-retention-pilot", name: "Retention Pilot", description: "Pilot journey for proactive churn prevention.", businessOwner: "Customer Growth", status: "INACTIVE" },
  ] as const;

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: project,
      create: { ...project, createdById: admin.id },
    });
  }

  const projectAssetLinks = [
    ["seed-project-claims-modernization", "seed-asset-claims-triage-service"],
    ["seed-project-claims-modernization", "seed-asset-fraud-model"],
    ["seed-project-claims-modernization", "seed-asset-policy-dataset"],
    ["seed-project-underwriting-workbench", "seed-asset-underwriting-copilot"],
    ["seed-project-underwriting-workbench", "seed-asset-policy-dataset"],
    ["seed-project-underwriting-workbench", "seed-asset-vector-library"],
    ["seed-project-retention-pilot", "seed-asset-customer-churn-model"],
    ["seed-project-retention-pilot", "seed-asset-policy-dataset"],
  ] as const;

  for (const [projectId, assetId] of projectAssetLinks) {
    await prisma.projectAsset.upsert({
      where: { projectId_assetId: { projectId, assetId } },
      update: {},
      create: { projectId, assetId },
    });
  }

  const risks = [
    { id: "seed-risk-low-doc-staleness", sourceFramework: "NIST_AI_RMF", sourceCategoryId: "GOVERN", euAiActRiskTier: null, description: "Model documentation may lag minor threshold changes.", likelihood: 1, impact: 3, inherentRiskScore: 3, residualRiskScore: 2, treatmentPlan: "Quarterly documentation review.", owner: "Model Governance", dueDate: "2026-09-15", status: "MITIGATED" },
    { id: "seed-risk-medium-vector-quality", sourceFramework: "OWASP_LLM_TOP10", sourceCategoryId: "LLM08", euAiActRiskTier: null, description: "Embedding drift could reduce retrieval relevance for policy searches.", likelihood: 2, impact: 4, inherentRiskScore: 8, residualRiskScore: 5, treatmentPlan: "Add retrieval quality regression suite.", owner: "Platform Engineering", dueDate: "2026-09-30", status: "IN_PROGRESS" },
    { id: "seed-risk-high-prompt-injection", sourceFramework: "OWASP_LLM_TOP10", sourceCategoryId: "LLM01", euAiActRiskTier: "HIGH", description: "Prompt injection could cause the copilot to ignore underwriting guidance.", likelihood: 3, impact: 4, inherentRiskScore: 12, residualRiskScore: 8, treatmentPlan: "Deploy prompt firewall and red-team test suite.", owner: "AI Enablement", dueDate: "2026-08-20", status: "OPEN" },
    { id: "seed-risk-critical-claims-bias", sourceFramework: "EU_AI_ACT", sourceCategoryId: "HIGH", euAiActRiskTier: "HIGH", description: "Claims triage model may create disparate handling outcomes across protected classes.", likelihood: 5, impact: 5, inherentRiskScore: 25, residualRiskScore: 16, treatmentPlan: "Complete fairness assessment and add human review thresholds.", owner: "Claims Risk", dueDate: "2026-08-10", status: "OPEN" },
    { id: "seed-risk-medium-data-retention", sourceFramework: "NIST_AI_RMF", sourceCategoryId: "MAP", euAiActRiskTier: null, description: "Retention pilot datasets may include stale opt-out attributes.", likelihood: 3, impact: 3, inherentRiskScore: 9, residualRiskScore: 4, treatmentPlan: "Refresh consent feed before pilot expansion.", owner: "Customer Growth", dueDate: "2026-10-05", status: "ACCEPTED" },
  ] as const;

  for (const risk of risks) {
    await prisma.risk.upsert({
      where: { id: risk.id },
      update: { ...risk, dueDate: new Date(risk.dueDate), createdById: admin.id },
      create: { ...risk, dueDate: new Date(risk.dueDate), createdById: admin.id },
    });
  }

  const assetRiskLinks = [
    ["seed-asset-fraud-model", "seed-risk-low-doc-staleness"],
    ["seed-asset-policy-dataset", "seed-risk-medium-vector-quality"],
    ["seed-asset-underwriting-copilot", "seed-risk-medium-vector-quality"],
    ["seed-asset-underwriting-copilot", "seed-risk-high-prompt-injection"],
    ["seed-asset-claims-triage-service", "seed-risk-critical-claims-bias"],
    ["seed-asset-fraud-model", "seed-risk-critical-claims-bias"],
    ["seed-asset-customer-churn-model", "seed-risk-medium-data-retention"],
  ] as const;

  for (const [assetId, riskId] of assetRiskLinks) {
    await prisma.assetRisk.upsert({
      where: { assetId_riskId: { assetId, riskId } },
      update: {},
      create: { assetId, riskId },
    });
  }

  await prisma.projectRisk.upsert({
    where: { projectId_riskId: { projectId: "seed-project-underwriting-workbench", riskId: "seed-risk-high-prompt-injection" } },
    update: {},
    create: { projectId: "seed-project-underwriting-workbench", riskId: "seed-risk-high-prompt-injection" },
  });

  const controls = [
    { id: "seed-control-prompt-firewall", name: "Prompt Firewall", mappedFramework: "OWASP_LLM_TOP10", mappedControlId: "LLM01-C1", description: "Detect and block prompt injection attempts before model invocation." },
    { id: "seed-control-fairness-review", name: "Fairness Review", mappedFramework: "EU_AI_ACT", mappedControlId: "HIGH-C1", description: "Run slice-based fairness checks before deployment and after major changes." },
    { id: "seed-control-retrieval-eval", name: "Retrieval Evaluation Suite", mappedFramework: "NIST_AI_RMF", mappedControlId: "MEASURE-C1", description: "Track retrieval precision and groundedness on approved benchmark queries." },
  ] as const;

  for (const control of controls) {
    await prisma.control.upsert({
      where: { mappedFramework_mappedControlId: { mappedFramework: control.mappedFramework, mappedControlId: control.mappedControlId } },
      update: control,
      create: control,
    });
  }

  const riskControls = [
    ["seed-risk-high-prompt-injection", "seed-control-prompt-firewall", "IN_PROGRESS", "Firewall rules implemented in staging."],
    ["seed-risk-critical-claims-bias", "seed-control-fairness-review", "NOT_STARTED", "Fairness review scheduled with compliance."],
    ["seed-risk-medium-vector-quality", "seed-control-retrieval-eval", "VERIFIED", "Nightly evaluation job is passing thresholds."],
  ] as const;

  for (const [riskId, controlId, implementationStatus, evidenceNotes] of riskControls) {
    await prisma.riskControl.upsert({
      where: { riskId_controlId: { riskId, controlId } },
      update: { implementationStatus, evidenceNotes },
      create: { riskId, controlId, implementationStatus, evidenceNotes },
    });
  }

  const fraudModelCard = await prisma.modelCard.upsert({
    where: { assetId: "seed-asset-fraud-model" },
    update: {
      approach: "Gradient-boosted decision tree classifier with calibrated probability output.",
      task: "Binary fraud likelihood classification",
      architectureFamily: "Tree ensemble",
      modelArchitecture: "XGBoost classifier",
      datasetsDescription: "Historical claims, investigation outcomes, and approved behavioral aggregates.",
      inputsDescription: "Claim amount, policy attributes, claim history, provider signals, and timing features.",
      outputsDescription: "Fraud likelihood score and explanation feature attributions.",
      intendedUsers: "Claims adjusters and fraud investigation analysts.",
      useCases: "Prioritize claims for additional review while preserving human decision authority.",
      technicalLimitations: "Performance degrades on novel claim types and sparse provider history.",
      performanceTradeoffs: "Higher recall threshold increases investigator workload.",
      ethicalConsiderations: "Human review is required before adverse customer impact.",
      fairnessAssessments: "Monthly slice analysis across geography, age bands, and claim type.",
      environmentalConsiderations: "Batch retraining only when drift thresholds are crossed.",
      performanceMetrics: { accuracy: 0.91, f1: 0.84, auc: 0.93 },
    },
    create: {
      assetId: "seed-asset-fraud-model",
      approach: "Gradient-boosted decision tree classifier with calibrated probability output.",
      task: "Binary fraud likelihood classification",
      architectureFamily: "Tree ensemble",
      modelArchitecture: "XGBoost classifier",
      datasetsDescription: "Historical claims, investigation outcomes, and approved behavioral aggregates.",
      inputsDescription: "Claim amount, policy attributes, claim history, provider signals, and timing features.",
      outputsDescription: "Fraud likelihood score and explanation feature attributions.",
      intendedUsers: "Claims adjusters and fraud investigation analysts.",
      useCases: "Prioritize claims for additional review while preserving human decision authority.",
      technicalLimitations: "Performance degrades on novel claim types and sparse provider history.",
      performanceTradeoffs: "Higher recall threshold increases investigator workload.",
      ethicalConsiderations: "Human review is required before adverse customer impact.",
      fairnessAssessments: "Monthly slice analysis across geography, age bands, and claim type.",
      environmentalConsiderations: "Batch retraining only when drift thresholds are crossed.",
      performanceMetrics: { accuracy: 0.91, f1: 0.84, auc: 0.93 },
    },
  });

  const metricRows = [
    { id: "seed-metric-fraud-accuracy", modelCardId: fraudModelCard.id, metricName: "accuracy", metricValue: 0.91, slice: "overall" },
    { id: "seed-metric-fraud-f1", modelCardId: fraudModelCard.id, metricName: "f1", metricValue: 0.84, slice: "overall" },
    { id: "seed-metric-fraud-auc", modelCardId: fraudModelCard.id, metricName: "auc", metricValue: 0.93, slice: "overall" },
    { id: "seed-metric-fraud-accuracy-small-claims", modelCardId: fraudModelCard.id, metricName: "accuracy", metricValue: 0.88, slice: "small claims" },
  ] as const;

  for (const metric of metricRows) {
    await prisma.modelCardMetric.upsert({
      where: { id: metric.id },
      update: metric,
      create: metric,
    });
  }

  const now = new Date();
  const overdue = new Date(now);
  overdue.setDate(overdue.getDate() - 7);
  const dueSoon = new Date(now);
  dueSoon.setDate(dueSoon.getDate() + 14);

  await prisma.recertificationSchedule.upsert({
    where: { assetId: "seed-asset-fraud-model" },
    update: { cadenceDays: 90, nextDueDate: overdue },
    create: { assetId: "seed-asset-fraud-model", cadenceDays: 90, nextDueDate: overdue },
  });
  await prisma.recertificationSchedule.upsert({
    where: { assetId: "seed-asset-underwriting-copilot" },
    update: { cadenceDays: 60, nextDueDate: dueSoon },
    create: { assetId: "seed-asset-underwriting-copilot", cadenceDays: 60, nextDueDate: dueSoon },
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exit(1);
  });

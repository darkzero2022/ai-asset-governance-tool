import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.user.upsert({
        where: { email: "admin@example.com" },
        update: {},
        create: {
            email: "admin@example.com",
            name: "Admin User",
            passwordHash: await bcrypt.hash("admin123", 10),
        },
    });
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
    ];
    for (const category of frameworkCategories) {
        await prisma.frameworkCategory.upsert({
            where: {
                framework_categoryId: {
                    framework: category.framework,
                    categoryId: category.categoryId,
                },
            },
            update: {
                name: category.name,
                description: category.description,
            },
            create: category,
        });
    }
    const tiers = [
        { tier: "UNACCEPTABLE", name: "Unacceptable", description: "Prohibited AI practices due to unacceptable risk." },
        { tier: "HIGH", name: "High", description: "High-risk AI systems requiring risk management and compliance controls." },
        { tier: "LIMITED", name: "Limited", description: "AI systems requiring transparency obligations." },
        { tier: "MINIMAL", name: "Minimal", description: "AI systems with minimal regulatory obligations." },
    ];
    for (const tier of tiers) {
        await prisma.euAiActRiskTierReference.upsert({
            where: { tier: tier.tier },
            update: { name: tier.name, description: tier.description },
            create: tier,
        });
    }
}
main()
    .finally(async () => {
    await prisma.$disconnect();
})
    .catch(async (error) => {
    console.error(error);
    process.exit(1);
});

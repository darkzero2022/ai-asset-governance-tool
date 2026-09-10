import type { StrideAiCategory, ThreatModelElementType } from "@aibom/shared";

export type RuleElement = {
  id: string;
  type: ThreatModelElementType;
  name: string;
  trustBoundaryId: string | null;
};

export type RuleFlow = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  authenticated: boolean;
  encrypted: boolean;
};

export type SuggestedThreat = {
  ruleId: string;
  elementId?: string;
  flowId?: string;
  title: string;
  description: string;
  strideAiCategory: StrideAiCategory | null;
  sourceFramework: "NIST_AI_RMF" | "EU_AI_ACT" | "OWASP_LLM_TOP10" | "OWASP_MCP_TOP10" | null;
  sourceCategoryId: string | null;
};

type Graph = { elements: RuleElement[]; flows: RuleFlow[] };

type Rule = {
  id: string;
  evaluate: (g: Graph) => SuggestedThreat[];
};

const byId = (g: Graph) => new Map(g.elements.map((e) => [e.id, e]));
const has = (g: Graph, t: ThreatModelElementType) => g.elements.some((e) => e.type === t);
const UNTRUSTED_SOURCES: ThreatModelElementType[] = ["END_USER", "EXTERNAL_DATA_SOURCE"];

const rules: Rule[] = [
  {
    id: "prompt-injection",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return (
            s &&
            t &&
            UNTRUSTED_SOURCES.includes(s.type) &&
            (t.type === "MODEL" || t.type === "INFERENCE_API")
          );
        })
        .map((f) => ({
          ruleId: "prompt-injection",
          flowId: f.id,
          title: "Prompt injection via untrusted input",
          description: `Input on "${f.label}" reaches the model without a trust boundary — a crafted payload can override the system instructions or exfiltrate context.`,
          strideAiCategory: "ALIGNMENT_BYPASS" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM01",
        }));
    },
  },
  {
    id: "training-data-poisoning",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return s?.type === "TRAINING_DATASET" && t?.type === "MODEL";
        })
        .map((f) => ({
          ruleId: "training-data-poisoning",
          flowId: f.id,
          title: "Training / fine-tuning data poisoning",
          description:
            "A training dataset feeds the model directly. Tampered or mislabelled records can implant backdoors or bias that survive into production.",
          strideAiCategory: "DATA_MODEL_POISONING" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM04",
        }));
    },
  },
  {
    id: "rag-poisoning",
    evaluate: (g) => {
      const map = byId(g);
      const externalIntoStore = g.flows.filter((f) => {
        const s = map.get(f.sourceId);
        const t = map.get(f.targetId);
        return s?.type === "EXTERNAL_DATA_SOURCE" && t?.type === "VECTOR_STORE";
      });
      return externalIntoStore.map((f) => ({
        ruleId: "rag-poisoning",
        flowId: f.id,
        title: "Retrieval (RAG) poisoning",
        description:
          "An external source writes into the vector store. Malicious documents can steer retrieval and inject instructions at inference time.",
        strideAiCategory: "DATA_MODEL_POISONING" as const,
        sourceFramework: "OWASP_LLM_TOP10" as const,
        sourceCategoryId: "LLM08",
      }));
    },
  },
  {
    id: "tool-poisoning",
    evaluate: (g) => {
      return g.elements
        .filter((e) => e.type === "TOOL_MCP_SERVER")
        .filter((e) => g.flows.some((f) => f.sourceId === e.id))
        .map((e) => ({
          ruleId: "tool-poisoning",
          elementId: e.id,
          title: `Tool poisoning via "${e.name}"`,
          description:
            "A compromised or malicious MCP tool/server can return misleading context that manipulates the model's decisions.",
          strideAiCategory: "DATA_MODEL_POISONING" as const,
          sourceFramework: "OWASP_MCP_TOP10" as const,
          sourceCategoryId: "MCP03",
        }));
    },
  },
  {
    id: "excessive-agency",
    evaluate: (g) => {
      const map = byId(g);
      const agenticTargets: ThreatModelElementType[] = [
        "PROCESS",
        "DATA_STORE",
        "EXTERNAL_DATA_SOURCE",
      ];
      return g.elements
        .filter((e) => e.type === "TOOL_MCP_SERVER")
        .filter((e) =>
          g.flows.some(
            (f) =>
              f.sourceId === e.id &&
              agenticTargets.includes(map.get(f.targetId)?.type as ThreatModelElementType),
          ),
        )
        .map((e) => ({
          ruleId: "excessive-agency",
          elementId: e.id,
          title: `Excessive agency through "${e.name}"`,
          description:
            "The model can trigger actions on external systems via this tool. Without scoping and confirmation it may perform actions beyond intent.",
          strideAiCategory: "ALIGNMENT_BYPASS" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM06",
        }));
    },
  },
  {
    id: "model-extraction",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return (
            (s?.type === "INFERENCE_API" || s?.type === "MODEL") &&
            (t?.type === "END_USER" || t?.type === "DOWNSTREAM_CONSUMER")
          );
        })
        .map((f) => ({
          ruleId: "model-extraction",
          flowId: f.id,
          title: "Model inversion / extraction via the inference API",
          description:
            "Output is returned to external consumers. High-volume or adaptive querying can reconstruct training data or approximate the model.",
          strideAiCategory: "MODEL_INVERSION" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM02",
        }));
    },
  },
  {
    id: "unbounded-consumption",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return s?.type === "END_USER" && (t?.type === "INFERENCE_API" || t?.type === "MODEL");
        })
        .map((f) => ({
          ruleId: "unbounded-consumption",
          flowId: f.id,
          title: "Unbounded consumption / denial of wallet",
          description:
            "End users drive inference directly. Without rate limits and quotas, abuse causes runaway cost or degraded service.",
          strideAiCategory: "RESOURCE_EXHAUSTION" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM10",
        }));
    },
  },
  {
    id: "improper-output-handling",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return (
            (s?.type === "MODEL" || s?.type === "INFERENCE_API") &&
            (t?.type === "PROCESS" || t?.type === "DOWNSTREAM_CONSUMER" || t?.type === "DATA_STORE")
          );
        })
        .map((f) => ({
          ruleId: "improper-output-handling",
          flowId: f.id,
          title: "Improper output handling downstream",
          description: `Model output flows to "${map.get(f.targetId)?.name}" on "${f.label}". If it is trusted without validation/encoding, it can drive injection (XSS, SQLi, SSRF) or unsafe actions.`,
          strideAiCategory: "ALIGNMENT_BYPASS" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM05",
        }));
    },
  },
  {
    id: "unauthenticated-cross-boundary",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return (
            s &&
            t &&
            (s.trustBoundaryId ?? null) !== (t.trustBoundaryId ?? null) &&
            !f.authenticated
          );
        })
        .map((f) => ({
          ruleId: "unauthenticated-cross-boundary",
          flowId: f.id,
          title: "Unauthenticated flow across a trust boundary",
          description: `"${f.label}" crosses a trust boundary without authentication — an attacker on the untrusted side can spoof the caller or the response.`,
          strideAiCategory: "MODEL_IMPERSONATION" as const,
          sourceFramework: "OWASP_MCP_TOP10" as const,
          sourceCategoryId: "MCP07",
        }));
    },
  },
  {
    id: "plaintext-cross-boundary",
    evaluate: (g) => {
      const map = byId(g);
      return g.flows
        .filter((f) => {
          const s = map.get(f.sourceId);
          const t = map.get(f.targetId);
          return (
            s && t && (s.trustBoundaryId ?? null) !== (t.trustBoundaryId ?? null) && !f.encrypted
          );
        })
        .map((f) => ({
          ruleId: "plaintext-cross-boundary",
          flowId: f.id,
          title: "Unencrypted flow across a trust boundary",
          description: `"${f.label}" leaves a trust boundary without transport encryption — prompts, outputs, or secrets in transit can be observed or modified.`,
          strideAiCategory: "MODEL_INVERSION" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM02",
        }));
    },
  },
  {
    id: "secret-exposure-mcp",
    evaluate: (g) =>
      g.elements
        .filter((e) => e.type === "TOOL_MCP_SERVER")
        .map((e) => ({
          ruleId: "secret-exposure-mcp",
          elementId: e.id,
          title: `Token / secret exposure at "${e.name}"`,
          description:
            "MCP servers hold credentials for the systems they front. Tokens leaked in context, memory, or logs grant an attacker that access.",
          strideAiCategory: "PROVENANCE_LOSS" as const,
          sourceFramework: "OWASP_MCP_TOP10" as const,
          sourceCategoryId: "MCP01",
        })),
  },
  {
    id: "no-human-review",
    evaluate: (g) => {
      const map = byId(g);
      if (has(g, "HUMAN_REVIEWER")) return [];
      const toConsumers = g.flows.filter((f) => {
        const s = map.get(f.sourceId);
        const t = map.get(f.targetId);
        return (
          (s?.type === "MODEL" || s?.type === "INFERENCE_API") &&
          (t?.type === "DOWNSTREAM_CONSUMER" || t?.type === "END_USER")
        );
      });
      if (toConsumers.length === 0) return [];
      return [
        {
          ruleId: "no-human-review",
          title: "No human-in-the-loop before consumers",
          description:
            "Model output reaches consumers with no human reviewer in the flow. Fabricated or misleading output is delivered as authoritative.",
          strideAiCategory: "ALIGNMENT_BYPASS" as const,
          sourceFramework: "OWASP_LLM_TOP10" as const,
          sourceCategoryId: "LLM09",
        },
      ];
    },
  },
  {
    id: "shadow-mcp",
    evaluate: (g) =>
      g.elements
        .filter((e) => e.type === "TOOL_MCP_SERVER" && !e.trustBoundaryId)
        .map((e) => ({
          ruleId: "shadow-mcp",
          elementId: e.id,
          title: `"${e.name}" runs outside any trust boundary`,
          description:
            "An MCP server with no trust boundary is effectively shadow infrastructure — likely running with default credentials and permissive config, outside governance.",
          strideAiCategory: "MODEL_IMPERSONATION" as const,
          sourceFramework: "OWASP_MCP_TOP10" as const,
          sourceCategoryId: "MCP09",
        })),
  },
];

/** Deterministic key so re-running suggestions doesn't duplicate a threat. */
export function threatKey(t: Pick<SuggestedThreat, "ruleId" | "elementId" | "flowId">): string {
  return `${t.ruleId}:${t.elementId ?? ""}:${t.flowId ?? ""}`;
}

export function evaluateRules(graph: Graph): SuggestedThreat[] {
  return rules.flatMap((rule) => rule.evaluate(graph));
}

export const RULE_IDS = rules.map((r) => r.id);

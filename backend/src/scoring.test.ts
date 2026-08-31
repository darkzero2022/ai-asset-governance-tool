import { describe, expect, it } from "vitest";
import { canTransitionAsset } from "./rbac.js";
import { HIGH_SEVERITY_MIN_SCORE, severityOf } from "./riskScoring.js";
import { modelCardCompleteness } from "./modelCardScoring.js";
import { resolveStrideAtlas } from "./strideAtlas.js";

describe("severityOf", () => {
  it("maps scores to stable severity bands", () => {
    expect(severityOf(1)).toBe("LOW");
    expect(severityOf(5)).toBe("LOW");
    expect(severityOf(6)).toBe("MEDIUM");
    expect(severityOf(HIGH_SEVERITY_MIN_SCORE - 1)).toBe("MEDIUM");
    expect(severityOf(HIGH_SEVERITY_MIN_SCORE)).toBe("HIGH");
    expect(severityOf(19)).toBe("HIGH");
    expect(severityOf(20)).toBe("CRITICAL");
  });
});

describe("modelCardCompleteness", () => {
  it("reports all required fields missing when no card exists", () => {
    expect(modelCardCompleteness(null)).toEqual({
      percent: 0,
      missingFields: ["task", "architecture", "intendedUsers", "useCases", "technicalLimitations", "ethicalConsiderations"],
    });
  });

  it("accepts either architectureFamily or modelArchitecture for architecture", () => {
    expect(modelCardCompleteness({
      task: "classification",
      architectureFamily: "tree ensemble",
      intendedUsers: "analysts",
      useCases: "triage",
      technicalLimitations: "limited cold-start performance",
      ethicalConsiderations: "human review required",
    })).toEqual({ percent: 100, missingFields: [] });

    expect(modelCardCompleteness({
      task: "classification",
      modelArchitecture: "xgboost",
      intendedUsers: "analysts",
      useCases: "triage",
      technicalLimitations: "limited cold-start performance",
      ethicalConsiderations: "human review required",
    })).toEqual({ percent: 100, missingFields: [] });
  });

  it("trims strings and calculates partial completeness", () => {
    expect(modelCardCompleteness({ task: "  ", architectureFamily: "transformer", intendedUsers: "reviewers" })).toEqual({
      percent: 33,
      missingFields: ["task", "useCases", "technicalLimitations", "ethicalConsiderations"],
    });
  });
});

describe("resolveStrideAtlas", () => {
  const llm03 = { strideAiCategory: "MODEL_IMPERSONATION", atlasTechnique: "ML Supply Chain Compromise" } as const;

  it("applies the lookup default when neither field is provided", () => {
    expect(resolveStrideAtlas({}, llm03)).toEqual({
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechnique: "ML Supply Chain Compromise",
    });
  });

  it("keeps an explicit value and treats empty string / null as unset", () => {
    expect(resolveStrideAtlas({ strideAiCategory: "PROVENANCE_LOSS", atlasTechnique: "" }, llm03)).toEqual({
      strideAiCategory: "PROVENANCE_LOSS",
      atlasTechnique: "ML Supply Chain Compromise",
    });
    expect(resolveStrideAtlas({ strideAiCategory: null, atlasTechnique: "Data Poisoning" }, llm03)).toEqual({
      strideAiCategory: "MODEL_IMPERSONATION",
      atlasTechnique: "Data Poisoning",
    });
  });

  it("returns nulls for a non-OWASP risk with no mapping and no provided values", () => {
    expect(resolveStrideAtlas({}, null)).toEqual({ strideAiCategory: null, atlasTechnique: null });
  });

  it("respects a null atlasTechnique in the lookup (e.g. LLM09)", () => {
    expect(resolveStrideAtlas({}, { strideAiCategory: "MODEL_INVERSION", atlasTechnique: null })).toEqual({
      strideAiCategory: "MODEL_INVERSION",
      atlasTechnique: null,
    });
  });
});

describe("canTransitionAsset", () => {
  it("allows admins to transition to every asset status", () => {
    for (const status of ["DRAFT", "UNDER_REVIEW", "APPROVED", "DEPLOYED", "RETIRED"]) {
      expect(canTransitionAsset("ADMIN", status)).toBe(true);
    }
  });

  it("limits risk owners to draft and under-review transitions", () => {
    expect(canTransitionAsset("RISK_OWNER", "DRAFT")).toBe(true);
    expect(canTransitionAsset("RISK_OWNER", "UNDER_REVIEW")).toBe(true);
    expect(canTransitionAsset("RISK_OWNER", "APPROVED")).toBe(false);
  });

  it("limits approvers to approval/deployment/retirement transitions", () => {
    expect(canTransitionAsset("APPROVER", "APPROVED")).toBe(true);
    expect(canTransitionAsset("APPROVER", "DEPLOYED")).toBe(true);
    expect(canTransitionAsset("APPROVER", "RETIRED")).toBe(true);
    expect(canTransitionAsset("APPROVER", "UNDER_REVIEW")).toBe(false);
  });

  it("denies viewers every transition", () => {
    expect(canTransitionAsset("VIEWER", "UNDER_REVIEW")).toBe(false);
    expect(canTransitionAsset("VIEWER", "APPROVED")).toBe(false);
  });
});

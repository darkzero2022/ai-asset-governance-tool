import type { StrideAiCategory } from "@prisma/client";
export { STRIDE_AI_CATEGORIES } from "@aibom/shared";

export type FrameworkThreatMapping = {
  strideAiCategory: StrideAiCategory | null;
  atlasTechniques: string[];
  atlasMitigations: string[];
} | null;

function isSet(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolve the STRIDE-AI category and single ATLAS technique to persist for a
 * risk, plus the ATLAS mitigations the mapping *suggests* when the request
 * supplies none.
 *
 * An explicit, non-empty strideAiCategory/atlasTechnique from the request always
 * wins; otherwise the mapping's default applies (which can be null — e.g. LLM09 /
 * MCP08 have no clean ATLAS technique). `suggestedMitigations` is just the
 * mapping's list; the caller decides whether to use it (only when the request
 * provides no mitigations of its own).
 */
export function resolveStrideAtlas(
  provided: { strideAiCategory?: string | null; atlasTechnique?: string | null },
  mapping: FrameworkThreatMapping,
): { strideAiCategory: StrideAiCategory | null; atlasTechnique: string | null; suggestedMitigations: string[] } {
  return {
    strideAiCategory: isSet(provided.strideAiCategory)
      ? (provided.strideAiCategory as StrideAiCategory)
      : mapping?.strideAiCategory ?? null,
    atlasTechnique: isSet(provided.atlasTechnique)
      ? provided.atlasTechnique.trim()
      : mapping?.atlasTechniques?.[0] ?? null,
    suggestedMitigations: mapping?.atlasMitigations ?? [],
  };
}

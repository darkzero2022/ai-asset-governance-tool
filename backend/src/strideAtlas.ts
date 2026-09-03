import type { StrideAiCategory } from "@prisma/client";
export { STRIDE_AI_CATEGORIES } from "@aibom/shared";

type StrideAtlasMapping = { strideAiCategory: StrideAiCategory; atlasTechnique: string | null } | null;

function isSet(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Resolve the STRIDE-AI category and ATLAS technique to persist for a risk.
 *
 * An explicit, non-empty value from the request always wins. Otherwise the
 * OWASP -> STRIDE-AI/ATLAS lookup default is applied (which can itself be null —
 * e.g. LLM09 has no clean ATLAS mapping). The lookup is a default, not a lock:
 * a later edit can override or clear either field.
 */
export function resolveStrideAtlas(
  provided: { strideAiCategory?: string | null; atlasTechnique?: string | null },
  mapping: StrideAtlasMapping,
): { strideAiCategory: StrideAiCategory | null; atlasTechnique: string | null } {
  return {
    strideAiCategory: isSet(provided.strideAiCategory)
      ? (provided.strideAiCategory as StrideAiCategory)
      : mapping?.strideAiCategory ?? null,
    atlasTechnique: isSet(provided.atlasTechnique)
      ? provided.atlasTechnique.trim()
      : mapping?.atlasTechnique ?? null,
  };
}

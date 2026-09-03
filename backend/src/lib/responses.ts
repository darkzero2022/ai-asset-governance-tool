import { Prisma } from "@prisma/client";
import { modelCardCompleteness } from "../modelCardScoring.js";
import { severityOf } from "../riskScoring.js";
import type { modelCardSchema } from "../schemas.js";
import type { z } from "zod";

export function riskResponse<T extends { assets?: Array<{ asset: unknown }> }>(risk: T) {
  const controlLinks =
    (risk as T & {
      controlLinks?: Array<{ control: object; implementationStatus: string; evidenceNotes: string | null }>;
    }).controlLinks ?? [];
  const assetLinks = (risk as T & { assets?: Array<{ assetId?: string; asset: unknown }> }).assets ?? [];
  const inherentRiskScore = (risk as T & { inherentRiskScore?: number }).inherentRiskScore;
  return {
    ...risk,
    severity: typeof inherentRiskScore === "number" ? severityOf(inherentRiskScore) : undefined,
    assetId: assetLinks[0]?.assetId ?? "",
    asset: assetLinks[0]?.asset ?? null,
    controls: controlLinks.map((link) => ({
      ...link.control,
      implementationStatus: link.implementationStatus,
      evidenceNotes: link.evidenceNotes,
    })),
  };
}

export function assetResponse<T extends { riskLinks?: Array<{ risk: unknown }> }>(asset: T) {
  return { ...asset, risks: asset.riskLinks?.map((link) => riskResponse(link.risk as never)) ?? [] };
}

export function assetListResponse<T extends { _count?: { riskLinks?: number; projectLinks?: number } }>(asset: T) {
  return {
    ...asset,
    _count: { risks: asset._count?.riskLinks ?? 0 },
    projectUsageCount: asset._count?.projectLinks ?? 0,
  };
}

export function assetForBom<T extends { riskLinks?: Array<{ risk: unknown }> }>(asset: T) {
  return { ...asset, risks: asset.riskLinks?.map((link) => riskResponse(link.risk as never)) ?? [] };
}

export function modelCardResponse<T extends object | null>(card: T) {
  return card ? { ...card, completeness: modelCardCompleteness(card) } : null;
}

export function modelCardData(body: z.infer<typeof modelCardSchema>) {
  const { performanceMetrics, ...data } = body;
  return {
    ...data,
    ...(performanceMetrics === undefined
      ? {}
      : {
          performanceMetrics:
            performanceMetrics === null ? Prisma.JsonNull : (performanceMetrics as Prisma.InputJsonValue),
        }),
  };
}

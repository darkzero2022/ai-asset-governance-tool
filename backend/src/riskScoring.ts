export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export const HIGH_SEVERITY_MIN_SCORE = 12;

export function severityOf(score: number): RiskSeverity {
  if (score >= 20) return "CRITICAL";
  if (score >= HIGH_SEVERITY_MIN_SCORE) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

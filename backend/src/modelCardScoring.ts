type ModelCardLike = {
  task?: string | null;
  architectureFamily?: string | null;
  modelArchitecture?: string | null;
  intendedUsers?: string | null;
  useCases?: string | null;
  technicalLimitations?: string | null;
  ethicalConsiderations?: string | null;
};

export const REQUIRED_MODEL_CARD_FIELDS = [
  "task",
  "architecture",
  "intendedUsers",
  "useCases",
  "technicalLimitations",
  "ethicalConsiderations",
] as const;

export function modelCardCompleteness(card: ModelCardLike | null | undefined) {
  const missingFields: string[] = [];

  if (!hasValue(card?.task)) missingFields.push("task");
  if (!hasValue(card?.architectureFamily) && !hasValue(card?.modelArchitecture))
    missingFields.push("architecture");
  if (!hasValue(card?.intendedUsers)) missingFields.push("intendedUsers");
  if (!hasValue(card?.useCases)) missingFields.push("useCases");
  if (!hasValue(card?.technicalLimitations)) missingFields.push("technicalLimitations");
  if (!hasValue(card?.ethicalConsiderations)) missingFields.push("ethicalConsiderations");

  const completeCount = REQUIRED_MODEL_CARD_FIELDS.length - missingFields.length;
  return {
    percent: Math.round((completeCount / REQUIRED_MODEL_CARD_FIELDS.length) * 100),
    missingFields,
  };
}

function hasValue(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

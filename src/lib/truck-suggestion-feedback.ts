export interface TruckSuggestionFeedbackInput {
  patientName: string;
  legType: string;
  pickupTime?: string | null;
  suitableCount: number;
}

/** User-facing confirmation only; ranking and eligibility stay in truck-suggestion.ts. */
export function buildTruckSuggestionFeedback({
  patientName,
  legType,
  pickupTime,
  suitableCount,
}: TruckSuggestionFeedbackInput): string {
  if (suitableCount === 0) {
    return `No suitable truck for ${patientName} — see reasons`;
  }

  const time = pickupTime ? ` ${pickupTime.slice(0, 5)}` : "";
  return `Ranked ${suitableCount} trucks for ${patientName} ${legType}${time} — drag to place`;
}

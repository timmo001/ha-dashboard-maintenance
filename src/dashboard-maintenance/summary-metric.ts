export const SUMMARY_METRICS = [
  "batteries",
  "repairs",
  "updates",
  "availability",
  "stale",
] as const;

export type SummaryMetric = (typeof SUMMARY_METRICS)[number];

export const DEFAULT_SUMMARY_METRIC: SummaryMetric = "batteries";

export const isSummaryMetric = (value?: string): value is SummaryMetric =>
  SUMMARY_METRICS.some((metric) => metric === value);

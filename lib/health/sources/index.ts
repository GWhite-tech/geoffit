/**
 * Metric-specific source preference + measurement merge.
 */

export {
  SourcePreferenceEngine,
  getMetricSourcePolicy,
  listMetricSourcePolicies,
  DEFAULT_DUPLICATE_WINDOW_MS,
} from "./source-preference-engine"
export type {
  SourcePolicyMode,
  SourcePreferenceMetricId,
  MetricSourcePolicy,
} from "./source-preference-engine"

export {
  DuplicateMeasurementEngine,
  clusterByTimeWindow,
  areNearDuplicates,
} from "./duplicate-measurement-engine"
export type {
  TimedMeasurement,
  DuplicateCluster,
} from "./duplicate-measurement-engine"

export {
  MeasurementMergeEngine,
  mergeMeasurementsForMetric,
  selectRecordsForMetric,
} from "./measurement-merge-engine"
export type { MergeResult } from "./measurement-merge-engine"

export {
  matchesSourcePreference,
  parseDeviceName,
  resolveDeviceName,
  sourceIdentity,
} from "./source-match"

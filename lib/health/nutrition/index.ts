export {
  getNutritionStore,
  resetNutritionStore,
  NutritionStore,
} from "./nutrition-store"
export {
  useNutritionStoreVersion,
  useNutritionSummary,
  useNutritionDay,
  useNutritionInsights,
  useNutritionAnchor,
  setNutritionTargets,
} from "./use-nutrition"
export {
  buildNutritionDaysFromHealthRecords,
  dietaryDayKeysFromHealthRecords,
  nutritionDayKeyFromStartDate,
  nutritionDayUtcBounds,
  nutritionDaysClinicallyEqual,
} from "./from-health-store"
export {
  createSupabaseDietaryDayLister,
  listAllDietaryHealthRecordsForDay,
  NUTRITION_DIETARY_DAY_PAGE_SIZE,
  recomputeNutritionDaysFromDurableHealth,
} from "./recompute-nutrition-days"
export type {
  DietaryDayListStats,
  DietaryDayLister,
} from "./recompute-nutrition-days"
export {
  buildNutritionSummary,
  buildNutritionChartData,
  buildMacroAdherence,
  buildNutritionInsights,
  buildMissionControlNutritionCards,
} from "./analytics"
export type {
  NutritionSummary,
  NutritionChartData,
  NutritionChartPoint,
  MacroAdherenceCard,
  NutritionInsight,
} from "./analytics"
export {
  filterDaysByRange,
  formatKcal,
  formatGrams,
  formatLitres,
  todayKey,
  type NutritionRange,
} from "./selectors"

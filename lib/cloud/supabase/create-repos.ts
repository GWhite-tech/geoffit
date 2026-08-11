/**
 * DI factory — only entry that binds SupabaseClient to fact repositories.
 * Product code must not call this until PR3/PR4.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import type { CloudRepositories } from "../repositories/types"
import { createBloodSupabaseRepository } from "./blood-supabase-repository"
import { createFactSyncSupabaseRepository } from "./fact-sync-supabase-repository"
import { createHealthSupabaseRepository } from "./health-supabase-repository"
import { createNutritionSupabaseRepository } from "./nutrition-supabase-repository"
import { createTreatmentSupabaseRepository } from "./treatment-supabase-repository"
import { createWorkoutSupabaseRepository } from "./workout-supabase-repository"

export function createCloudRepositories(
  supabase: SupabaseClient
): CloudRepositories {
  return {
    health: createHealthSupabaseRepository(supabase),
    blood: createBloodSupabaseRepository(supabase),
    workouts: createWorkoutSupabaseRepository(supabase),
    treatments: createTreatmentSupabaseRepository(supabase),
    nutrition: createNutritionSupabaseRepository(supabase),
    factSync: createFactSyncSupabaseRepository(supabase),
  }
}

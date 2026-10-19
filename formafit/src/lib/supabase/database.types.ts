
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "ai_conversations": {
                  Row: {
                    "created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ai_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"meta": Json | null,"role": Database["public"]['Enums']["chat_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"meta"?: Json | null,"role": Database["public"]['Enums']["chat_role"],"user_id": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"meta"?: Json | null,"role"?: Database["public"]['Enums']["chat_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "ai_conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"ai_request_log": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"diary_entries": {
                  Row: {
                    "brand": string | null,"carbs_per_100g": number | null,"consumption_id": string | null,"created_at": string,"entry_date": string,"fat_per_100g": number | null,"fiber_per_100g": number | null,"food_id": string | null,"food_name": string,"id": string,"kcal_per_100g": number | null,"meal_slot": Database["public"]['Enums']["meal_slot"],"note": string | null,"position": number,"protein_per_100g": number | null,"quantity_g": number,"recipe_id": string | null,"recipe_name": string | null,"source_ingredient_id": string | null,"updated_at": string,"user_id": string,"verification": Database["public"]['Enums']["verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"carbs_per_100g"?: number | null,"consumption_id"?: string | null,"created_at"?: string,"entry_date": string,"fat_per_100g"?: number | null,"fiber_per_100g"?: number | null,"food_id"?: string | null,"food_name": string,"id"?: string,"kcal_per_100g"?: number | null,"meal_slot": Database["public"]['Enums']["meal_slot"],"note"?: string | null,"position"?: number,"protein_per_100g"?: number | null,"quantity_g": number,"recipe_id"?: string | null,"recipe_name"?: string | null,"source_ingredient_id"?: string | null,"updated_at"?: string,"user_id": string,"verification": Database["public"]['Enums']["verification_status"]
                  }
                  Update: {
                    "brand"?: string | null,"carbs_per_100g"?: number | null,"consumption_id"?: string | null,"created_at"?: string,"entry_date"?: string,"fat_per_100g"?: number | null,"fiber_per_100g"?: number | null,"food_id"?: string | null,"food_name"?: string,"id"?: string,"kcal_per_100g"?: number | null,"meal_slot"?: Database["public"]['Enums']["meal_slot"],"note"?: string | null,"position"?: number,"protein_per_100g"?: number | null,"quantity_g"?: number,"recipe_id"?: string | null,"recipe_name"?: string | null,"source_ingredient_id"?: string | null,"updated_at"?: string,"user_id"?: string,"verification"?: Database["public"]['Enums']["verification_status"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "diary_entries_consumption_id_fkey"
      columns: ["consumption_id"]
isOneToOne: false
      referencedRelation: "meal_consumptions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diary_entries_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "diary_entries_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"exercises": {
                  Row: {
                    "created_at": string,"equipment": string,"id": string,"image_credit": string | null,"image_path": string | null,"image_url": string | null,"instructions": (string)[],"is_archived": boolean,"mechanics": string,"name": string,"owner_id": string | null,"primary_muscles": (string)[],"secondary_muscles": (string)[],"slug": string,"tips": string | null,"updated_at": string,"video_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"equipment": string,"id"?: string,"image_credit"?: string | null,"image_path"?: string | null,"image_url"?: string | null,"instructions"?: (string)[],"is_archived"?: boolean,"mechanics"?: string,"name": string,"owner_id"?: string | null,"primary_muscles": (string)[],"secondary_muscles"?: (string)[],"slug": string,"tips"?: string | null,"updated_at"?: string,"video_url"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"equipment"?: string,"id"?: string,"image_credit"?: string | null,"image_path"?: string | null,"image_url"?: string | null,"instructions"?: (string)[],"is_archived"?: boolean,"mechanics"?: string,"name"?: string,"owner_id"?: string | null,"primary_muscles"?: (string)[],"secondary_muscles"?: (string)[],"slug"?: string,"tips"?: string | null,"updated_at"?: string,"video_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"favorite_foods": {
                  Row: {
                    "created_at": string,"food_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "favorite_foods_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"food_servings": {
                  Row: {
                    "created_at": string,"food_id": string,"grams": number,"id": string,"label": string,"owner_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"grams": number,"id"?: string,"label": string,"owner_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"grams"?: number,"id"?: string,"label"?: string,"owner_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "food_servings_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    }
                  ]
                },"foods": {
                  Row: {
                    "allergens": (string)[],"allergens_known": boolean,"barcode": string | null,"brand": string | null,"canonical_name": string,"carbs_per_100g": number | null,"category": Database["public"]['Enums']["grocery_category"],"created_at": string,"diet_tags": (string)[],"fat_per_100g": number | null,"fiber_per_100g": number | null,"id": string,"image_credit": string | null,"image_path": string | null,"image_url": string | null,"is_archived": boolean,"kcal_per_100g": number | null,"name": string,"owner_id": string | null,"preparation": Database["public"]['Enums']["food_preparation"],"protein_per_100g": number | null,"source": Database["public"]['Enums']["food_source"],"source_note": string | null,"source_ref": string | null,"updated_at": string,"verification": Database["public"]['Enums']["verification_status"]
                  }
                  ComputedFields: never
                  Insert: {
                    "allergens"?: (string)[],"allergens_known"?: boolean,"barcode"?: string | null,"brand"?: string | null,"canonical_name": string,"carbs_per_100g"?: number | null,"category"?: Database["public"]['Enums']["grocery_category"],"created_at"?: string,"diet_tags"?: (string)[],"fat_per_100g"?: number | null,"fiber_per_100g"?: number | null,"id"?: string,"image_credit"?: string | null,"image_path"?: string | null,"image_url"?: string | null,"is_archived"?: boolean,"kcal_per_100g"?: number | null,"name": string,"owner_id"?: string | null,"preparation"?: Database["public"]['Enums']["food_preparation"],"protein_per_100g"?: number | null,"source": Database["public"]['Enums']["food_source"],"source_note"?: string | null,"source_ref"?: string | null,"updated_at"?: string,"verification": Database["public"]['Enums']["verification_status"]
                  }
                  Update: {
                    "allergens"?: (string)[],"allergens_known"?: boolean,"barcode"?: string | null,"brand"?: string | null,"canonical_name"?: string,"carbs_per_100g"?: number | null,"category"?: Database["public"]['Enums']["grocery_category"],"created_at"?: string,"diet_tags"?: (string)[],"fat_per_100g"?: number | null,"fiber_per_100g"?: number | null,"id"?: string,"image_credit"?: string | null,"image_path"?: string | null,"image_url"?: string | null,"is_archived"?: boolean,"kcal_per_100g"?: number | null,"name"?: string,"owner_id"?: string | null,"preparation"?: Database["public"]['Enums']["food_preparation"],"protein_per_100g"?: number | null,"source"?: Database["public"]['Enums']["food_source"],"source_note"?: string | null,"source_ref"?: string | null,"updated_at"?: string,"verification"?: Database["public"]['Enums']["verification_status"]
                  }
                  Relationships: [
                    
                  ]
                },"meal_consumptions": {
                  Row: {
                    "consumed_on": string,"created_at": string,"id": string,"meal_name": string,"meal_slot": Database["public"]['Enums']["meal_slot"],"planned_meal_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "consumed_on": string,"created_at"?: string,"id"?: string,"meal_name": string,"meal_slot": Database["public"]['Enums']["meal_slot"],"planned_meal_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "consumed_on"?: string,"created_at"?: string,"id"?: string,"meal_name"?: string,"meal_slot"?: Database["public"]['Enums']["meal_slot"],"planned_meal_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "meal_consumptions_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    }
                  ]
                },"meal_plans": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"generation_meta": Json | null,"id": string,"name": string,"notes": string | null,"num_days": number,"source": Database["public"]['Enums']["plan_source"],"start_date": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"generation_meta"?: Json | null,"id"?: string,"name": string,"notes"?: string | null,"num_days"?: number,"source"?: Database["public"]['Enums']["plan_source"],"start_date": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"generation_meta"?: Json | null,"id"?: string,"name"?: string,"notes"?: string | null,"num_days"?: number,"source"?: Database["public"]['Enums']["plan_source"],"start_date"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"measurements": {
                  Row: {
                    "arm_cm": number | null,"body_fat_pct": number | null,"chest_cm": number | null,"created_at": string,"hips_cm": number | null,"id": string,"measured_on": string,"notes": string | null,"thigh_cm": number | null,"updated_at": string,"user_id": string,"waist_cm": number | null,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "arm_cm"?: number | null,"body_fat_pct"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hips_cm"?: number | null,"id"?: string,"measured_on": string,"notes"?: string | null,"thigh_cm"?: number | null,"updated_at"?: string,"user_id": string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Update: {
                    "arm_cm"?: number | null,"body_fat_pct"?: number | null,"chest_cm"?: number | null,"created_at"?: string,"hips_cm"?: number | null,"id"?: string,"measured_on"?: string,"notes"?: string | null,"thigh_cm"?: number | null,"updated_at"?: string,"user_id"?: string,"waist_cm"?: number | null,"weight_kg"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"nutrition_targets": {
                  Row: {
                    "activity_multiplier": number | null,"bmr_kcal": number | null,"calculation_inputs": Json | null,"calories": number,"carbs_g": number,"created_at": string,"fat_g": number,"goal_adjustment_pct": number | null,"is_manually_adjusted": boolean,"method": string,"protein_g": number,"tdee_kcal": number | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_multiplier"?: number | null,"bmr_kcal"?: number | null,"calculation_inputs"?: Json | null,"calories": number,"carbs_g": number,"created_at"?: string,"fat_g": number,"goal_adjustment_pct"?: number | null,"is_manually_adjusted"?: boolean,"method": string,"protein_g": number,"tdee_kcal"?: number | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "activity_multiplier"?: number | null,"bmr_kcal"?: number | null,"calculation_inputs"?: Json | null,"calories"?: number,"carbs_g"?: number,"created_at"?: string,"fat_g"?: number,"goal_adjustment_pct"?: number | null,"is_manually_adjusted"?: boolean,"method"?: string,"protein_g"?: number,"tdee_kcal"?: number | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "nutrition_targets_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_meal_ingredients": {
                  Row: {
                    "created_at": string,"food_id": string,"id": string,"note": string | null,"planned_meal_id": string,"position": number,"quantity_g": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"id"?: string,"note"?: string | null,"planned_meal_id": string,"position"?: number,"quantity_g": number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"id"?: string,"note"?: string | null,"planned_meal_id"?: string,"position"?: number,"quantity_g"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meal_ingredients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meal_ingredients_planned_meal_id_fkey"
      columns: ["planned_meal_id"]
isOneToOne: false
      referencedRelation: "planned_meals"
      referencedColumns: ["id"]
    }
                  ]
                },"planned_meals": {
                  Row: {
                    "created_at": string,"day_index": number,"id": string,"image_path": string | null,"instructions": string | null,"meal_slot": Database["public"]['Enums']["meal_slot"],"meal_time": string | null,"name": string,"notes": string | null,"plan_id": string,"position": number,"prep_minutes": number | null,"source_recipe_id": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"day_index": number,"id"?: string,"image_path"?: string | null,"instructions"?: string | null,"meal_slot"?: Database["public"]['Enums']["meal_slot"],"meal_time"?: string | null,"name": string,"notes"?: string | null,"plan_id": string,"position"?: number,"prep_minutes"?: number | null,"source_recipe_id"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"day_index"?: number,"id"?: string,"image_path"?: string | null,"instructions"?: string | null,"meal_slot"?: Database["public"]['Enums']["meal_slot"],"meal_time"?: string | null,"name"?: string,"notes"?: string | null,"plan_id"?: string,"position"?: number,"prep_minutes"?: number | null,"source_recipe_id"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planned_meals_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "planned_meals_source_recipe_id_fkey"
      columns: ["source_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "activity_level": Database["public"]['Enums']["activity_level"] | null,"age": number | null,"allergies": (string)[],"created_at": string,"daily_steps": number | null,"diet_preferences": (string)[],"display_name": string | null,"equipment": (string)[],"experience": Database["public"]['Enums']["experience_level"] | null,"food_restrictions": (string)[],"goal": Database["public"]['Enums']["goal_type"] | null,"goal_weight_kg": number | null,"height_cm": number | null,"id": string,"meals_per_day": number,"onboarding_completed_at": string | null,"sex": Database["public"]['Enums']["sex_type"],"start_weight_kg": number | null,"training_days_per_week": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"age"?: number | null,"allergies"?: (string)[],"created_at"?: string,"daily_steps"?: number | null,"diet_preferences"?: (string)[],"display_name"?: string | null,"equipment"?: (string)[],"experience"?: Database["public"]['Enums']["experience_level"] | null,"food_restrictions"?: (string)[],"goal"?: Database["public"]['Enums']["goal_type"] | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"id": string,"meals_per_day"?: number,"onboarding_completed_at"?: string | null,"sex"?: Database["public"]['Enums']["sex_type"],"start_weight_kg"?: number | null,"training_days_per_week"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "activity_level"?: Database["public"]['Enums']["activity_level"] | null,"age"?: number | null,"allergies"?: (string)[],"created_at"?: string,"daily_steps"?: number | null,"diet_preferences"?: (string)[],"display_name"?: string | null,"equipment"?: (string)[],"experience"?: Database["public"]['Enums']["experience_level"] | null,"food_restrictions"?: (string)[],"goal"?: Database["public"]['Enums']["goal_type"] | null,"goal_weight_kg"?: number | null,"height_cm"?: number | null,"id"?: string,"meals_per_day"?: number,"onboarding_completed_at"?: string | null,"sex"?: Database["public"]['Enums']["sex_type"],"start_weight_kg"?: number | null,"training_days_per_week"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"program_days": {
                  Row: {
                    "created_at": string,"id": string,"is_rest_day": boolean,"name": string,"notes": string | null,"position": number,"program_id": string,"updated_at": string,"user_id": string,"weekday": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"is_rest_day"?: boolean,"name": string,"notes"?: string | null,"position"?: number,"program_id": string,"updated_at"?: string,"user_id": string,"weekday"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"is_rest_day"?: boolean,"name"?: string,"notes"?: string | null,"position"?: number,"program_id"?: string,"updated_at"?: string,"user_id"?: string,"weekday"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_days_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "workout_programs"
      referencedColumns: ["id"]
    }
                  ]
                },"program_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"program_day_id": string,"rep_max": number,"rep_min": number,"rest_seconds": number,"sets": number,"suggested_weight_kg": number | null,"superset_group": number | null,"tempo": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position"?: number,"program_day_id": string,"rep_max"?: number,"rep_min"?: number,"rest_seconds"?: number,"sets"?: number,"suggested_weight_kg"?: number | null,"superset_group"?: number | null,"tempo"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"program_day_id"?: string,"rep_max"?: number,"rep_min"?: number,"rest_seconds"?: number,"sets"?: number,"suggested_weight_kg"?: number | null,"superset_group"?: number | null,"tempo"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "program_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "program_exercises_program_day_id_fkey"
      columns: ["program_day_id"]
isOneToOne: false
      referencedRelation: "program_days"
      referencedColumns: ["id"]
    }
                  ]
                },"progress_photos": {
                  Row: {
                    "created_at": string,"id": string,"notes": string | null,"pose": string,"storage_path": string,"taken_on": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"pose"?: string,"storage_path": string,"taken_on": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"notes"?: string | null,"pose"?: string,"storage_path"?: string,"taken_on"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"recipe_ingredients": {
                  Row: {
                    "created_at": string,"food_id": string,"id": string,"note": string | null,"position": number,"quantity_g": number,"recipe_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"food_id": string,"id"?: string,"note"?: string | null,"position"?: number,"quantity_g": number,"recipe_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"food_id"?: string,"id"?: string,"note"?: string | null,"position"?: number,"quantity_g"?: number,"recipe_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_ingredients_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_ingredients_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "created_at": string,"default_slot": Database["public"]['Enums']["meal_slot"] | null,"id": string,"image_path": string | null,"instructions": string | null,"kind": string,"name": string,"notes": string | null,"prep_minutes": number | null,"servings": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_slot"?: Database["public"]['Enums']["meal_slot"] | null,"id"?: string,"image_path"?: string | null,"instructions"?: string | null,"kind"?: string,"name": string,"notes"?: string | null,"prep_minutes"?: number | null,"servings"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"default_slot"?: Database["public"]['Enums']["meal_slot"] | null,"id"?: string,"image_path"?: string | null,"instructions"?: string | null,"kind"?: string,"name"?: string,"notes"?: string | null,"prep_minutes"?: number | null,"servings"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"session_exercises": {
                  Row: {
                    "created_at": string,"exercise_id": string,"id": string,"notes": string | null,"position": number,"program_exercise_id": string | null,"rep_max": number | null,"rep_min": number | null,"rest_seconds": number,"session_id": string,"superset_group": number | null,"tempo": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"exercise_id": string,"id"?: string,"notes"?: string | null,"position"?: number,"program_exercise_id"?: string | null,"rep_max"?: number | null,"rep_min"?: number | null,"rest_seconds"?: number,"session_id": string,"superset_group"?: number | null,"tempo"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"exercise_id"?: string,"id"?: string,"notes"?: string | null,"position"?: number,"program_exercise_id"?: string | null,"rep_max"?: number | null,"rep_min"?: number | null,"rest_seconds"?: number,"session_id"?: string,"superset_group"?: number | null,"tempo"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_exercises_exercise_id_fkey"
      columns: ["exercise_id"]
isOneToOne: false
      referencedRelation: "exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_exercises_program_exercise_id_fkey"
      columns: ["program_exercise_id"]
isOneToOne: false
      referencedRelation: "program_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_exercises_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"session_sets": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"id": string,"is_completed": boolean,"is_warmup": boolean,"reps": number | null,"rir": number | null,"session_exercise_id": string,"session_id": string,"set_number": number,"target_reps": number | null,"target_weight_kg": number | null,"updated_at": string,"user_id": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"is_completed"?: boolean,"is_warmup"?: boolean,"reps"?: number | null,"rir"?: number | null,"session_exercise_id": string,"session_id": string,"set_number": number,"target_reps"?: number | null,"target_weight_kg"?: number | null,"updated_at"?: string,"user_id": string,"weight_kg"?: number | null
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"id"?: string,"is_completed"?: boolean,"is_warmup"?: boolean,"reps"?: number | null,"rir"?: number | null,"session_exercise_id"?: string,"session_id"?: string,"set_number"?: number,"target_reps"?: number | null,"target_weight_kg"?: number | null,"updated_at"?: string,"user_id"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_sets_session_exercise_id_fkey"
      columns: ["session_exercise_id"]
isOneToOne: false
      referencedRelation: "session_exercises"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "session_sets_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "workout_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_list_items": {
                  Row: {
                    "category": Database["public"]['Enums']["grocery_category"],"created_at": string,"food_id": string | null,"id": string,"is_custom": boolean,"is_purchased": boolean,"list_id": string,"name": string,"note": string | null,"position": number,"preparation": Database["public"]['Enums']["food_preparation"] | null,"price_sek": number | null,"quantity": number | null,"unit": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: Database["public"]['Enums']["grocery_category"],"created_at"?: string,"food_id"?: string | null,"id"?: string,"is_custom"?: boolean,"is_purchased"?: boolean,"list_id": string,"name": string,"note"?: string | null,"position"?: number,"preparation"?: Database["public"]['Enums']["food_preparation"] | null,"price_sek"?: number | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: Database["public"]['Enums']["grocery_category"],"created_at"?: string,"food_id"?: string | null,"id"?: string,"is_custom"?: boolean,"is_purchased"?: boolean,"list_id"?: string,"name"?: string,"note"?: string | null,"position"?: number,"preparation"?: Database["public"]['Enums']["food_preparation"] | null,"price_sek"?: number | null,"quantity"?: number | null,"unit"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_list_items_food_id_fkey"
      columns: ["food_id"]
isOneToOne: false
      referencedRelation: "foods"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shopping_list_items_list_id_fkey"
      columns: ["list_id"]
isOneToOne: false
      referencedRelation: "shopping_lists"
      referencedColumns: ["id"]
    }
                  ]
                },"shopping_lists": {
                  Row: {
                    "created_at": string,"end_date": string | null,"id": string,"meal_plan_id": string | null,"name": string,"start_date": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"meal_plan_id"?: string | null,"name": string,"start_date"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_date"?: string | null,"id"?: string,"meal_plan_id"?: string | null,"name"?: string,"start_date"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "shopping_lists_meal_plan_id_fkey"
      columns: ["meal_plan_id"]
isOneToOne: false
      referencedRelation: "meal_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "ai_share_logs": boolean,"created_at": string,"default_rest_seconds": number,"updated_at": string,"user_id": string,"water_goal_ml": number,"weight_increment_kg": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_share_logs"?: boolean,"created_at"?: string,"default_rest_seconds"?: number,"updated_at"?: string,"user_id": string,"water_goal_ml"?: number,"weight_increment_kg"?: number
                  }
                  Update: {
                    "ai_share_logs"?: boolean,"created_at"?: string,"default_rest_seconds"?: number,"updated_at"?: string,"user_id"?: string,"water_goal_ml"?: number,"weight_increment_kg"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_preferences_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"water_logs": {
                  Row: {
                    "amount_ml": number,"created_at": string,"id": string,"log_date": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_ml": number,"created_at"?: string,"id"?: string,"log_date": string,"user_id": string
                  }
                  Update: {
                    "amount_ml"?: number,"created_at"?: string,"id"?: string,"log_date"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_programs": {
                  Row: {
                    "created_at": string,"description": string | null,"generation_meta": Json | null,"id": string,"is_active": boolean,"is_template": boolean,"name": string,"source": Database["public"]['Enums']["plan_source"],"split_type": Database["public"]['Enums']["split_type"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string | null,"generation_meta"?: Json | null,"id"?: string,"is_active"?: boolean,"is_template"?: boolean,"name": string,"source"?: Database["public"]['Enums']["plan_source"],"split_type"?: Database["public"]['Enums']["split_type"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string | null,"generation_meta"?: Json | null,"id"?: string,"is_active"?: boolean,"is_template"?: boolean,"name"?: string,"source"?: Database["public"]['Enums']["plan_source"],"split_type"?: Database["public"]['Enums']["split_type"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"workout_sessions": {
                  Row: {
                    "completed_at": string | null,"created_at": string,"feedback": Database["public"]['Enums']["session_feedback"] | null,"id": string,"name": string,"notes": string | null,"paused_at": string | null,"paused_seconds": number,"program_day_id": string | null,"program_id": string | null,"scheduled_for": string | null,"started_at": string,"status": Database["public"]['Enums']["session_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"created_at"?: string,"feedback"?: Database["public"]['Enums']["session_feedback"] | null,"id"?: string,"name": string,"notes"?: string | null,"paused_at"?: string | null,"paused_seconds"?: number,"program_day_id"?: string | null,"program_id"?: string | null,"scheduled_for"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"created_at"?: string,"feedback"?: Database["public"]['Enums']["session_feedback"] | null,"id"?: string,"name"?: string,"notes"?: string | null,"paused_at"?: string | null,"paused_seconds"?: number,"program_day_id"?: string | null,"program_id"?: string | null,"scheduled_for"?: string | null,"started_at"?: string,"status"?: Database["public"]['Enums']["session_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workout_sessions_program_day_id_fkey"
      columns: ["program_day_id"]
isOneToOne: false
      referencedRelation: "program_days"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workout_sessions_program_id_fkey"
      columns: ["program_id"]
isOneToOne: false
      referencedRelation: "workout_programs"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "complete_workout_session":
{ Args: { "p_feedback"?: Database["public"]['Enums']["session_feedback"],"p_notes"?: string,"p_session_id": string }; Returns: undefined
                           },
"consume_ai_quota":
{ Args: { "p_kind": string,"p_limit": number,"p_window_minutes": number }; Returns: boolean
                           },
"copy_diary_entries":
{ Args: { "p_from": string,"p_slot"?: Database["public"]['Enums']["meal_slot"],"p_target_slot"?: Database["public"]['Enums']["meal_slot"],"p_to": string }; Returns: number
                           },
"copy_plan_day":
{ Args: { "p_from_day": number,"p_plan_id": string,"p_replace"?: boolean,"p_to_day": number }; Returns: number
                           },
"create_meal_plan":
{ Args: { "p_plan": Json }; Returns: string
                           },
"create_workout_program":
{ Args: { "p_program": Json }; Returns: string
                           },
"duplicate_meal_plan":
{ Args: { "p_name": string,"p_plan_id": string,"p_start_date": string }; Returns: string
                           },
"duplicate_planned_meal":
{ Args: { "p_meal_id": string,"p_target_day"?: number }; Returns: string
                           },
"duplicate_workout_program":
{ Args: { "p_name": string,"p_program_id": string }; Returns: string
                           },
"mark_planned_meal_eaten":
{ Args: { "p_date": string,"p_planned_meal_id": string }; Returns: {
              "consumption_id": string,"created": boolean
            }[]
                           },
"set_active_program":
{ Args: { "p_program_id": string }; Returns: undefined
                           },
"start_workout_session":
{ Args: { "p_name"?: string,"p_program_day_id"?: string,"p_scheduled_for"?: string }; Returns: string
                           },
"undo_meal_consumption":
{ Args: { "p_consumption_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "activity_level": "sedentary"|"light"|"moderate"|"active"|"very_active","chat_role": "user"|"assistant","experience_level": "beginner"|"intermediate"|"advanced","food_preparation": "raw"|"cooked"|"dried"|"as_sold","food_source": "livsmedelsverket"|"openfoodfacts"|"user"|"starter_reference","goal_type": "fat_loss"|"muscle_gain"|"maintenance","grocery_category": "meat_fish"|"dairy"|"grains"|"produce"|"pantry"|"other","meal_slot": "breakfast"|"lunch"|"dinner"|"snack","plan_source": "manual"|"ai","session_feedback": "too_easy"|"just_right"|"too_hard","session_status": "in_progress"|"paused"|"completed"|"abandoned","sex_type": "male"|"female"|"unspecified","split_type": "push_pull_legs"|"upper_lower"|"full_body"|"bro_split"|"custom","verification_status": "verified"|"community"|"user_entered"|"estimated"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "activity_level": ["sedentary", "light", "moderate", "active", "very_active"],"chat_role": ["user", "assistant"],"experience_level": ["beginner", "intermediate", "advanced"],"food_preparation": ["raw", "cooked", "dried", "as_sold"],"food_source": ["livsmedelsverket", "openfoodfacts", "user", "starter_reference"],"goal_type": ["fat_loss", "muscle_gain", "maintenance"],"grocery_category": ["meat_fish", "dairy", "grains", "produce", "pantry", "other"],"meal_slot": ["breakfast", "lunch", "dinner", "snack"],"plan_source": ["manual", "ai"],"session_feedback": ["too_easy", "just_right", "too_hard"],"session_status": ["in_progress", "paused", "completed", "abandoned"],"sex_type": ["male", "female", "unspecified"],"split_type": ["push_pull_legs", "upper_lower", "full_body", "bro_split", "custom"],"verification_status": ["verified", "community", "user_entered", "estimated"]
          }
        }
} as const

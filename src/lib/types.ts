export type StorePreference = {
  name: string
  fulfillment: 'in_store' | 'pickup'
  supportsOnlineOrdering: boolean
}

export type Preferences = {
  id?: string
  user_id?: string
  budget_weekly: number | null
  budget_per_meal: number | null
  allergies: string[]
  blacklisted_foods: string[]
  preferred_stores: StorePreference[]
  health_goals: string[]
  household_size: number
  meals_per_day: number
  snacks_per_day: number
  zip_code: string
}

export const defaultPreferences: Preferences = {
  budget_weekly: null,
  budget_per_meal: null,
  allergies: [],
  blacklisted_foods: [],
  preferred_stores: [],
  health_goals: [],
  household_size: 1,
  meals_per_day: 3,
  snacks_per_day: 1,
  zip_code: '',
}

export type PantryItem = {
  id: string
  user_id: string
  name: string
  category: string
  quantity: number
  unit: string
  date_added: string
  expiration_date: string | null
  estimated_expiration_date: string | null
  removed_at: string | null
  created_at: string
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Meal = {
  day: string
  breakfast: string
  lunch: string
  dinner: string
}

type GroceryItem = {
  item: string
  quantity: string
  estimatedCost: number
  category: string
}

type WeeklyPlan = {
  id: string
  week_start_date: string
  meals: Meal[]
  grocery_list: GroceryItem[]
  estimated_total_cost: number
  confirmed_at: string | null
  created_at: string
}

export default function HistoryPage() {
  const [plans, setPlans] = useState<WeeklyPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const supabase = createClient()

  const loadPlans = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', user.id)
      .not('confirmed_at', 'is', null)
      .order('week_start_date', { ascending: false })

    setPlans(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadPlans() }, [loadPlans])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-stone-200 rounded-xl animate-pulse" />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-stone-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">📋</div>
        <p className="text-stone-700 font-semibold text-lg">No plans yet</p>
        <p className="text-stone-400 text-sm mt-1 max-w-xs">
          Confirmed weekly meal plans will appear here so you can look back and reuse your favorites.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-stone-900">Plan History</h2>
        <p className="text-stone-400 text-sm mt-1">{plans.length} confirmed plan{plans.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="space-y-3">
        {plans.map(plan => {
          const isExpanded = expandedId === plan.id
          const weekDate = new Date(plan.week_start_date + 'T12:00:00')
          const weekLabel = weekDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const totalItems = plan.grocery_list?.length ?? 0

          return (
            <div key={plan.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
              <button
                onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🗓️</span>
                  </div>
                  <div>
                    <p className="font-semibold text-stone-900">Week of {weekLabel}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {totalItems} grocery items
                      {plan.estimated_total_cost ? ` · est. $${plan.estimated_total_cost.toFixed(2)}` : ''}
                    </p>
                  </div>
                </div>
                <span className={`text-stone-400 transition-transform text-sm ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
              </button>

              {isExpanded && (
                <div className="border-t border-stone-100 px-5 py-4 space-y-5">

                  {/* Meal plan */}
                  {plan.meals?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Meal Plan</p>
                      <div className="space-y-1">
                        {plan.meals.map(meal => (
                          <div key={meal.day} className="grid grid-cols-4 gap-2 text-sm py-2 border-b border-stone-50 last:border-0">
                            <span className="font-medium text-stone-700">{meal.day}</span>
                            <span className="text-stone-500 truncate">{meal.breakfast}</span>
                            <span className="text-stone-500 truncate">{meal.lunch}</span>
                            <span className="text-stone-500 truncate">{meal.dinner}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-4 text-xs text-stone-300 mt-2">
                        <span>B = Breakfast</span>
                        <span>L = Lunch</span>
                        <span>D = Dinner</span>
                      </div>
                    </div>
                  )}

                  {/* Grocery list summary */}
                  {plan.grocery_list?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Grocery List</p>
                      <div className="flex flex-wrap gap-1.5">
                        {plan.grocery_list.map((item, i) => (
                          <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2.5 py-1 rounded-full">
                            {item.item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

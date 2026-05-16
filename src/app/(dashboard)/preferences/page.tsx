'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { GROCERY_CHAINS, HEALTH_GOALS } from '@/lib/stores'
import { Preferences, StorePreference, defaultPreferences } from '@/lib/types'

type TagInputProps = {
  label: string
  placeholder: string
  values: string[]
  onChange: (values: string[]) => void
}

function TagInput({ label, placeholder, values, onChange }: TagInputProps) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }

  function remove(val: string) {
    onChange(values.filter(v => v !== val))
  }

  return (
    <div>
      <label className="block text-sm font-medium text-stone-700 mb-1">{label}</label>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder}
          className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors"
        >
          Add
        </button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map(val => (
            <span key={val} className="flex items-center gap-1 bg-emerald-50 text-emerald-800 text-xs px-3 py-1 rounded-full">
              {val}
              <button type="button" onClick={() => remove(val)} className="hover:text-emerald-600 font-bold ml-1">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function PreferencesPage() {
  const [prefs, setPrefs] = useState<Preferences>(defaultPreferences)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [storeSearch, setStoreSearch] = useState('')

  const supabase = createClient()

  const loadPreferences = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (data) {
      setPrefs({
        ...data,
        preferred_stores: data.preferred_stores ?? [],
        allergies: data.allergies ?? [],
        blacklisted_foods: data.blacklisted_foods ?? [],
        health_goals: data.health_goals ?? [],
      })
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    loadPreferences()
  }, [loadPreferences])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('preferences').upsert({
      ...prefs,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function toggleStore(name: string, supportsOnlineOrdering: boolean) {
    const exists = prefs.preferred_stores.find(s => s.name === name)
    if (exists) {
      setPrefs(p => ({ ...p, preferred_stores: p.preferred_stores.filter(s => s.name !== name) }))
    } else {
      const newStore: StorePreference = { name, fulfillment: 'in_store', supportsOnlineOrdering }
      setPrefs(p => ({ ...p, preferred_stores: [...p.preferred_stores, newStore] }))
    }
  }

  function toggleFulfillment(name: string, fulfillment: 'in_store' | 'pickup') {
    setPrefs(p => ({
      ...p,
      preferred_stores: p.preferred_stores.map(s => s.name === name ? { ...s, fulfillment } : s)
    }))
  }

  function toggleGoal(goal: string) {
    const exists = prefs.health_goals.includes(goal)
    setPrefs(p => ({
      ...p,
      health_goals: exists ? p.health_goals.filter(g => g !== goal) : [...p.health_goals, goal]
    }))
  }

  const filteredStores = GROCERY_CHAINS.filter(s =>
    s.name.toLowerCase().includes(storeSearch.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-stone-400 text-sm">Loading preferences...</div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-stone-900">Preferences</h2>
        <p className="text-stone-400 text-sm mt-1">Your settings personalize your meal plans and grocery lists.</p>
      </div>

      {/* Budget */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Budget</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Weekly grocery budget</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-stone-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={prefs.budget_weekly ?? ''}
                onChange={e => setPrefs(p => ({ ...p, budget_weekly: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full border border-stone-300 rounded-lg pl-6 pr-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Per meal target</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-stone-400 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={prefs.budget_per_meal ?? ''}
                onChange={e => setPrefs(p => ({ ...p, budget_per_meal: e.target.value ? parseFloat(e.target.value) : null }))}
                className="w-full border border-stone-300 rounded-lg pl-6 pr-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Household */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Household</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">People cooking for</label>
            <input
              type="number"
              min="1"
              max="20"
              value={prefs.household_size}
              onChange={e => setPrefs(p => ({ ...p, household_size: parseInt(e.target.value) || 1 }))}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Meals per day</label>
            <select
              value={prefs.meals_per_day}
              onChange={e => setPrefs(p => ({ ...p, meals_per_day: parseInt(e.target.value) }))}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={1}>1 meal</option>
              <option value={2}>2 meals</option>
              <option value={3}>3 meals</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Snacks per day</label>
            <select
              value={prefs.snacks_per_day}
              onChange={e => setPrefs(p => ({ ...p, snacks_per_day: parseInt(e.target.value) }))}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={0}>No snacks</option>
              <option value={1}>1 snack</option>
              <option value={2}>2 snacks</option>
              <option value={3}>3 snacks</option>
            </select>
          </div>
        </div>
      </section>

      {/* Dietary */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Dietary</h3>
        <TagInput
          label="Allergies"
          placeholder="e.g. peanuts, shellfish (press Enter)"
          values={prefs.allergies}
          onChange={v => setPrefs(p => ({ ...p, allergies: v }))}
        />
        <TagInput
          label="Foods to never buy"
          placeholder="e.g. cilantro, Brussels sprouts (press Enter)"
          values={prefs.blacklisted_foods}
          onChange={v => setPrefs(p => ({ ...p, blacklisted_foods: v }))}
        />
      </section>

      {/* Health Goals */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Health Goals</h3>
        <div className="flex flex-wrap gap-2">
          {HEALTH_GOALS.map(goal => {
            const active = prefs.health_goals.includes(goal)
            return (
              <button
                key={goal}
                type="button"
                onClick={() => toggleGoal(goal)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {goal}
              </button>
            )
          })}
        </div>
      </section>

      {/* Grocery Stores */}
      <section className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4 shadow-sm">
        <h3 className="font-semibold text-stone-900">Preferred Grocery Stores</h3>
        <input
          type="text"
          placeholder="Search stores..."
          value={storeSearch}
          onChange={e => setStoreSearch(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {filteredStores.map(store => {
            const selected = prefs.preferred_stores.find(s => s.name === store.name)
            return (
              <div key={store.name} className={`rounded-xl border p-3 transition-colors ${selected ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200'}`}>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={() => toggleStore(store.name, store.supportsOnlineOrdering)}
                      className="accent-emerald-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-stone-700">{store.name}</span>
                    {store.supportsOnlineOrdering && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Online ordering</span>
                    )}
                  </label>
                </div>
                {selected && store.supportsOnlineOrdering && (
                  <div className="mt-2 ml-7 flex gap-3">
                    <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="radio"
                        name={`fulfillment-${store.name}`}
                        checked={selected.fulfillment === 'in_store'}
                        onChange={() => toggleFulfillment(store.name, 'in_store')}
                        className="accent-emerald-600"
                      />
                      Shop in store
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="radio"
                        name={`fulfillment-${store.name}`}
                        checked={selected.fulfillment === 'pickup'}
                        onChange={() => toggleFulfillment(store.name, 'pickup')}
                        className="accent-emerald-600"
                      />
                      Order for pickup
                    </label>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl text-sm transition-colors"
        >
          {saving ? 'Saving...' : 'Save preferences'}
        </button>
        {saved && <span className="text-emerald-600 text-sm font-medium">Saved!</span>}
      </div>
    </form>
  )
}

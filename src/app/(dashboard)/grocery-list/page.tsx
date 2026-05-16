'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type GroceryItem = {
  item: string
  quantity: string
  estimatedCost: number
  category: string
}

type StorePreference = {
  name: string
  fulfillment: 'in_store' | 'pickup'
  supportsOnlineOrdering: boolean
}

type WeeklyPlan = {
  id: string
  week_start_date: string
  grocery_list: GroceryItem[]
  estimated_total_cost: number
  confirmed_at: string | null
}

const CATEGORY_ORDER = [
  'Produce', 'Meat & Fish', 'Dairy', 'Frozen', 'Dry Goods',
  'Canned Goods', 'Beverages', 'Condiments', 'Snacks', 'Other'
]

const ONLINE_ORDERING_STORES = ['Whole Foods', 'Kroger', 'Safeway', 'Publix', 'Walmart', 'Target', 'Sprouts', 'H-E-B', 'Wegmans', 'Meijer', 'Stop & Shop', 'Giant', 'Food Lion', 'ShopRite', 'Harris Teeter']

function getAmazonFreshLink(item: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(item)}&i=amazonfresh`
}

function getStoreLink(storeName: string, item: string) {
  const links: Record<string, (item: string) => string> = {
    'Whole Foods': (i) => `https://www.amazon.com/s?k=${encodeURIComponent(i)}&i=amazonfresh`,
    'Kroger': (i) => `https://www.kroger.com/search?query=${encodeURIComponent(i)}`,
    'Walmart': (i) => `https://www.walmart.com/search?q=${encodeURIComponent(i)}`,
    'Target': (i) => `https://www.target.com/s?searchTerm=${encodeURIComponent(i)}`,
    'Safeway': (i) => `https://www.safeway.com/shop/search-results.html?q=${encodeURIComponent(i)}`,
    'Publix': (i) => `https://www.publix.com/shop/search?query=${encodeURIComponent(i)}`,
  }
  return links[storeName]?.(item) ?? null
}

function getStoreHomeLink(storeName: string) {
  const links: Record<string, string> = {
    'Whole Foods': 'https://www.amazon.com/alm/storefront?almBrandId=QW1hem9uIEZyZXNo',
    'Kroger': 'https://www.kroger.com',
    'Walmart': 'https://www.walmart.com/grocery',
    'Target': 'https://www.target.com/c/grocery/-/N-5xt1a',
    'Safeway': 'https://www.safeway.com',
    'Publix': 'https://www.publix.com',
  }
  return links[storeName] ?? null
}

export default function GroceryListPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [preferredStores, setPreferredStores] = useState<StorePreference[]>([])
  const [selectedStore, setSelectedStore] = useState<string | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const supabase = createClient()

  const loadPlan = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)

    const { data } = await supabase
      .from('weekly_plans')
      .select('id, week_start_date, grocery_list, estimated_total_cost, confirmed_at')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart.toISOString().split('T')[0])
      .single()

    if (data) setPlan(data as WeeklyPlan)

    const { data: prefs } = await supabase
      .from('preferences')
      .select('preferred_stores')
      .eq('user_id', user.id)
      .single()

    if (prefs?.preferred_stores) {
      const stores = prefs.preferred_stores as StorePreference[]
      setPreferredStores(stores)
      // Auto-select first store that supports pickup, otherwise first store
      const pickupStore = stores.find(s => s.fulfillment === 'pickup' && s.supportsOnlineOrdering)
      setSelectedStore(pickupStore?.name ?? stores[0]?.name ?? null)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => { loadPlan() }, [loadPlan])

  const isOnlineStore = selectedStore ? ONLINE_ORDERING_STORES.includes(selectedStore) : false
  const storeLink = selectedStore ? getStoreLink(selectedStore, '') : null
  const storeHomeLink = selectedStore ? getStoreHomeLink(selectedStore) : null

  function toggleItem(item: string) {
    const isChecking = !checkedItems.has(item)
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      return next
    })
    if (isChecking && selectedStore && isOnlineStore) {
      const link = getStoreLink(selectedStore, item)
      if (link) window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  function checkAll() {
    if (!plan) return
    setCheckedItems(new Set(plan.grocery_list.map(i => i.item)))
  }

  function uncheckAll() {
    setCheckedItems(new Set())
  }

  function copyList() {
    if (!plan) return
    const text = plan.grocery_list
      .map(i => `• ${i.item} — ${i.quantity}`)
      .join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-stone-400 text-sm">Loading grocery list...</div>
  }

  if (!plan || !plan.confirmed_at || !plan.grocery_list?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <p className="text-stone-600 font-medium">No grocery list yet</p>
        <p className="text-stone-400 text-sm mt-1 max-w-xs">
          Head to the Planner tab, build your weekly meal plan, and confirm it to generate your grocery list.
        </p>
      </div>
    )
  }

  const grouped = CATEGORY_ORDER.reduce<Record<string, GroceryItem[]>>((acc, cat) => {
    const items = plan.grocery_list.filter(i => i.category === cat)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  const uncategorized = plan.grocery_list.filter(i => !CATEGORY_ORDER.includes(i.category))
  if (uncategorized.length > 0) grouped['Other'] = [...(grouped['Other'] ?? []), ...uncategorized]

  const checkedCount = checkedItems.size
  const totalItems = plan.grocery_list.length
  const remaining = totalItems - checkedCount
  const allChecked = checkedCount === totalItems

  return (
    <div className="space-y-5 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Grocery List</h2>
          <p className="text-stone-400 text-sm mt-0.5">
            Week of {new Date(plan.week_start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-stone-800">${plan.estimated_total_cost?.toFixed(2) ?? '—'}</p>
          <p className="text-xs text-stone-400">est. total</p>
        </div>
      </div>

      {/* Store selector */}
      {preferredStores.length > 0 && (
        <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-stone-700">Where are you shopping today?</p>
          <div className="flex flex-wrap gap-2">
            {preferredStores.map(store => (
              <button
                key={store.name}
                onClick={() => setSelectedStore(store.name)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedStore === store.name
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-stone-600 border-stone-300 hover:border-emerald-400'
                }`}
              >
                {store.name}
                {store.supportsOnlineOrdering && store.fulfillment === 'pickup' && (
                  <span className="ml-1.5 text-xs opacity-75">pickup</span>
                )}
              </button>
            ))}
          </div>

          {selectedStore && isOnlineStore && storeHomeLink && (
            <div className="flex items-center gap-3 pt-1">
              <a
                href={storeHomeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Open {selectedStore} →
              </a>
              <p className="text-xs text-stone-400">Click items below to search and add to your cart</p>
            </div>
          )}

          {selectedStore && !isOnlineStore && (
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={copyList}
                className="flex items-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
              >
                {copied ? 'Copied!' : 'Copy list'}
              </button>
              <p className="text-xs text-stone-400">Copy your list to reference while shopping in store</p>
            </div>
          )}
        </div>
      )}

      {/* Progress + check all */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex justify-between text-sm w-full">
            <span className="text-stone-600 font-medium">{remaining} item{remaining !== 1 ? 's' : ''} remaining</span>
            <button
              onClick={allChecked ? uncheckAll : checkAll}
              className="text-emerald-600 text-sm font-medium hover:text-emerald-700 transition-colors"
            >
              {allChecked ? 'Uncheck all' : 'Check all'}
            </button>
          </div>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-2">
          <div
            className="bg-emerald-500 h-2 rounded-full transition-all"
            style={{ width: totalItems > 0 ? `${(checkedCount / totalItems) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Items grouped by category */}
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{category}</h3>
          <div className="bg-white rounded-2xl border border-stone-200 divide-y divide-stone-100 overflow-hidden">
            {items.map((item, idx) => {
              const checked = checkedItems.has(item.item)
              const itemLink = selectedStore && isOnlineStore ? getStoreLink(selectedStore, item.item) : null

              return (
                <div
                  key={idx}
                  className={`flex items-center justify-between px-4 py-3 transition-colors ${checked ? 'bg-stone-50' : ''}`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.item)}
                      className="accent-emerald-600 w-4 h-4 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <span className={`text-sm font-medium ${checked ? 'line-through text-stone-400' : 'text-stone-800'}`}>
                        {item.item}
                      </span>
                      {!checked && itemLink && (
                        <span className="ml-1.5 text-xs text-emerald-500">→ opens store</span>
                      )}
                      <p className="text-xs text-stone-400">{item.quantity}</p>
                    </div>
                  </label>
                  <span className="text-xs text-stone-400 flex-shrink-0 ml-4">
                    ${item.estimatedCost?.toFixed(2) ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {checkedCount === totalItems && totalItems > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-emerald-800">All done! Happy cooking.</p>
        </div>
      )}
    </div>
  )
}

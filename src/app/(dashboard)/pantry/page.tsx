'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES, estimateExpiration, getFreshnessStatus, getFreshnessLabel, STATUS_STYLES, STATUS_DOT } from '@/lib/pantry'
import { PantryItem } from '@/lib/types'

type ScanResult = {
  name: string
  category: string
  freshness: 'fresh' | 'use_soon' | 'toss'
  freshnessNote: string
}

type FormState = {
  name: string
  category: string
  quantity: string
  unit: string
  expiration_date: string
}

const emptyForm: FormState = {
  name: '',
  category: 'Produce',
  quantity: '1',
  unit: '',
  expiration_date: '',
}

const FRESHNESS_STYLES = {
  fresh: 'bg-emerald-50 border-emerald-300 text-emerald-800',
  use_soon: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  toss: 'bg-red-50 border-red-300 text-red-700',
}

const FRESHNESS_LABELS = {
  fresh: 'Looks fresh',
  use_soon: 'Use soon',
  toss: 'Consider tossing',
}

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const loadItems = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('pantry_items')
      .select('*')
      .eq('user_id', user.id)
      .is('removed_at', null)
      .order('created_at', { ascending: false })

    setItems(data ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadItems() }, [loadItems])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const dateAdded = new Date()
    const estimatedExp = estimateExpiration(form.category, dateAdded)

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      category: form.category,
      quantity: parseFloat(form.quantity) || 1,
      unit: form.unit.trim(),
      date_added: dateAdded.toISOString(),
      expiration_date: form.expiration_date ? new Date(form.expiration_date).toISOString() : null,
      estimated_expiration_date: estimatedExp.toISOString(),
    }

    if (editingId) {
      await supabase.from('pantry_items').update(payload).eq('id', editingId)
    } else {
      await supabase.from('pantry_items').insert(payload)
    }

    setForm(emptyForm)
    setShowForm(false)
    setEditingId(null)
    setScanResult(null)
    setSaving(false)
    loadItems()
  }

  async function handleRemove(id: string) {
    await supabase.from('pantry_items').update({ removed_at: new Date().toISOString() }).eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  function handleEdit(item: PantryItem) {
    setForm({
      name: item.name,
      category: item.category,
      quantity: String(item.quantity),
      unit: item.unit ?? '',
      expiration_date: item.expiration_date ? item.expiration_date.split('T')[0] : '',
    })
    setEditingId(item.id)
    setScanResult(null)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handlePhotoScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setScanning(true)
    setScanResult(null)

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const mediaType = file.type

      try {
        const res = await fetch('/api/scan-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mediaType }),
        })

        if (!res.ok) throw new Error(`Server error ${res.status}`)

        const data = await res.json()
        if (data.name) {
          setScanResult(data)
          setForm(prev => ({ ...prev, name: data.name, category: data.category ?? prev.category }))
          setShowForm(true)
        }
      } catch (err) {
        console.error('Scan failed:', err)
        alert('Photo scan failed. Please check your API key or try again.')
      }
      setScanning(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const expiringItems = items.filter(item => {
    const exp = item.expiration_date ?? item.estimated_expiration_date
    if (!exp) return false
    const status = getFreshnessStatus(new Date(exp))
    return status === 'expiring' || status === 'soon'
  })

  const groupedItems = CATEGORIES.reduce<Record<string, PantryItem[]>>((acc, cat) => {
    const catItems = items.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-stone-400 text-sm">Loading pantry...</div>
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Pantry</h2>
          <p className="text-stone-400 text-sm mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''} tracked</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
          >
            {scanning ? 'Scanning...' : '📷 Scan'}
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(emptyForm); setScanResult(null) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            + Add item
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoScan} className="hidden" />
      </div>

      {/* Scan result banner */}
      {scanResult && (
        <div className={`rounded-2xl border p-4 ${FRESHNESS_STYLES[scanResult.freshness]}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-sm">{FRESHNESS_LABELS[scanResult.freshness]} — {scanResult.name}</p>
              <p className="text-xs mt-0.5 opacity-80">{scanResult.freshnessNote}</p>
              <p className="text-xs mt-1 opacity-60 italic">Visual estimate only — not a food safety guarantee.</p>
            </div>
            <button onClick={() => setScanResult(null)} className="text-lg opacity-50 hover:opacity-80 ml-4">×</button>
          </div>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 p-5 space-y-4">
          <h3 className="font-semibold text-stone-800">{editingId ? 'Edit item' : 'Add item'}</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-stone-700 mb-1">Item name</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Roma tomatoes"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Expiration date <span className="text-stone-400 font-normal">(optional)</span></label>
              <input
                type="date"
                value={form.expiration_date}
                onChange={e => setForm(p => ({ ...p, expiration_date: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.quantity}
                onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Unit <span className="text-stone-400 font-normal">(optional)</span></label>
              <input
                type="text"
                value={form.unit}
                onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. lbs, oz, cups"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {!form.expiration_date && (
            <p className="text-xs text-stone-400">No expiration date entered — we'll estimate one based on the category.</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors"
            >
              {saving ? 'Saving...' : editingId ? 'Update item' : 'Add to pantry'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); setScanResult(null) }}
              className="px-5 py-2 text-stone-500 hover:text-stone-700 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Expiring soon alert */}
      {expiringItems.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="text-sm font-semibold text-orange-800 mb-1">Use these soon</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {expiringItems.map(item => (
              <span key={item.id} className="text-xs bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full">
                {item.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-5xl mb-4">🧺</div>
          <p className="text-stone-500 font-medium">Your pantry is empty</p>
          <p className="text-stone-400 text-sm mt-1">Add items manually or tap Scan to photograph food.</p>
        </div>
      )}

      {/* Items grouped by category */}
      {Object.entries(groupedItems).map(([category, catItems]) => (
        <div key={category}>
          <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{category}</h3>
          <div className="space-y-2">
            {catItems.map(item => {
              const expDate = item.expiration_date ?? item.estimated_expiration_date
              const status = expDate ? getFreshnessStatus(new Date(expDate)) : 'fresh'
              const label = expDate ? getFreshnessLabel(new Date(expDate)) : null
              const isEstimated = !item.expiration_date && !!item.estimated_expiration_date

              return (
                <div key={item.id} className="bg-white rounded-xl border border-stone-200 px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-800 truncate">{item.name}</p>
                      <p className="text-xs text-stone-400">
                        {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                        {label && <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${STATUS_STYLES[status]}`}>{label}{isEstimated ? ' (est.)' : ''}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => handleEdit(item)} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">Edit</button>
                    <button onClick={() => handleRemove(item.id)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

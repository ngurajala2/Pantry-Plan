export const CATEGORIES = [
  'Produce',
  'Dairy',
  'Meat & Fish',
  'Cooked / Leftovers',
  'Dry Goods',
  'Frozen',
  'Canned Goods',
  'Beverages',
  'Condiments',
  'Snacks',
  'Other',
]

const SHELF_LIFE_DAYS: Record<string, number> = {
  'Produce': 5,
  'Dairy': 10,
  'Meat & Fish': 2,
  'Cooked / Leftovers': 4,
  'Dry Goods': 270,
  'Frozen': 120,
  'Canned Goods': 548,
  'Beverages': 180,
  'Condiments': 180,
  'Snacks': 90,
  'Other': 14,
}

export function estimateExpiration(category: string, dateAdded: Date): Date {
  const days = SHELF_LIFE_DAYS[category] ?? 14
  const result = new Date(dateAdded)
  result.setDate(result.getDate() + days)
  return result
}

export function getFreshnessStatus(expirationDate: Date): 'fresh' | 'soon' | 'expiring' | 'expired' {
  const now = new Date()
  const diffDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'expired'
  if (diffDays <= 1) return 'expiring'
  if (diffDays <= 4) return 'soon'
  return 'fresh'
}

export function getFreshnessLabel(expirationDate: Date): string {
  const now = new Date()
  const diffDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'Expired'
  if (diffDays === 0) return 'Expires today'
  if (diffDays === 1) return 'Expires tomorrow'
  if (diffDays <= 4) return `Expires in ${diffDays} days`
  return `${diffDays} days left`
}

export const STATUS_STYLES = {
  fresh: 'bg-emerald-100 text-emerald-800',
  soon: 'bg-yellow-100 text-yellow-800',
  expiring: 'bg-orange-100 text-orange-800',
  expired: 'bg-red-100 text-red-700',
}

export const STATUS_DOT = {
  fresh: 'bg-emerald-500',
  soon: 'bg-yellow-400',
  expiring: 'bg-orange-500',
  expired: 'bg-red-500',
}

export type Store = {
  name: string
  supportsOnlineOrdering: boolean
}

export const GROCERY_CHAINS: Store[] = [
  { name: 'Whole Foods', supportsOnlineOrdering: true },
  { name: 'Trader Joe\'s', supportsOnlineOrdering: false },
  { name: 'Kroger', supportsOnlineOrdering: true },
  { name: 'Safeway', supportsOnlineOrdering: true },
  { name: 'Publix', supportsOnlineOrdering: true },
  { name: 'Costco', supportsOnlineOrdering: false },
  { name: 'Walmart', supportsOnlineOrdering: true },
  { name: 'Target', supportsOnlineOrdering: true },
  { name: 'Aldi', supportsOnlineOrdering: false },
  { name: 'Sprouts', supportsOnlineOrdering: true },
  { name: 'H-E-B', supportsOnlineOrdering: true },
  { name: 'Wegmans', supportsOnlineOrdering: true },
  { name: 'Meijer', supportsOnlineOrdering: true },
  { name: 'Stop & Shop', supportsOnlineOrdering: true },
  { name: 'Giant', supportsOnlineOrdering: true },
  { name: 'Food Lion', supportsOnlineOrdering: true },
  { name: 'ShopRite', supportsOnlineOrdering: true },
  { name: 'Harris Teeter', supportsOnlineOrdering: true },
  { name: 'Fresh Market', supportsOnlineOrdering: false },
  { name: 'Grocery Outlet', supportsOnlineOrdering: false },
]

export const HEALTH_GOALS = [
  'Weight loss',
  'Muscle gain',
  'Low carb',
  'Low sodium',
  'Heart health',
  'High protein',
  'Vegetarian',
  'Vegan',
  'Gluten free',
  'Dairy free',
  'Mediterranean diet',
  'Balanced / maintenance',
]

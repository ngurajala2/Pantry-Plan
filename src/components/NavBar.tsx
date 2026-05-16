'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

const tabs = [
  { href: '/planner', label: 'Planner', icon: '🗓️' },
  { href: '/pantry', label: 'Pantry', icon: '🧺' },
  { href: '/grocery-list', label: 'Grocery List', icon: '🛒' },
  { href: '/history', label: 'History', icon: '📋' },
  { href: '/preferences', label: 'Preferences', icon: '⚙️' },
]

export default function NavBar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-bold text-stone-900 tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Pantry & Plan</span>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-stone-400 hover:text-stone-600 transition-colors px-2 py-1 rounded-lg hover:bg-stone-100"
          >
            Sign out
          </button>
        </div>

        <nav className="flex gap-0.5 -mb-px overflow-x-auto">
          {tabs.map(tab => {
            const active = pathname.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  active
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300'
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}

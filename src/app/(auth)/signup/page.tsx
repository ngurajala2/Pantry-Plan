'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] px-4">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-stone-200 shadow-sm p-8">
          <div className="text-4xl mb-4">📬</div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Check your email</h2>
          <p className="text-stone-400 text-sm">
            We sent a confirmation link to{' '}
            <span className="font-medium text-stone-700">{email}</span>.
            Click it to activate your account.
          </p>
          <Link href="/login" className="inline-block mt-6 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
            Back to sign in →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Logo size={48} />
          </div>
          <h1 className="text-3xl font-bold text-stone-900">Pantry & Plan</h1>
          <p className="text-stone-400 mt-1 text-sm">Create your account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-stone-50"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border border-stone-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-stone-50"
              placeholder="At least 8 characters"
            />
          </div>

          <button
            type="submit"
            onClick={handleSignup}
            disabled={loading}
            className="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition-colors mt-2"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </div>

        <p className="text-center text-sm text-stone-400 mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-stone-700 font-medium hover:text-emerald-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

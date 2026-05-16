'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Meal = {
  day: string
  breakfast: string
  lunch: string
  dinner: string
}

function parseMealPlan(text: string): Meal[] | null {
  const planMatch = text.match(/MEAL PLAN:([\s\S]*?)(?:\n\n|$)/)
  if (!planMatch) return null

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const meals: Meal[] = []

  for (const day of days) {
    const dayMatch = planMatch[1].match(new RegExp(`${day}:\\s*([^\\n]+)`))
    if (dayMatch) {
      const parts = dayMatch[1].split('|').map(s => s.trim())
      meals.push({
        day,
        breakfast: parts[0] ?? 'TBD',
        lunch: parts[1] ?? 'TBD',
        dinner: parts[2] ?? 'TBD',
      })
    }
  }

  return meals.length === 7 ? meals : null
}

function MealPlanCard({ meals, onConfirm, confirming }: { meals: Meal[], onConfirm: () => void, confirming: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-emerald-200 overflow-hidden mt-3">
      <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-100">
        <p className="font-semibold text-emerald-800 text-sm">Your Weekly Meal Plan</p>
      </div>
      <div className="divide-y divide-stone-100">
        {meals.map(meal => (
          <div key={meal.day} className="px-4 py-3 grid grid-cols-4 gap-2 text-sm">
            <span className="font-medium text-stone-700">{meal.day}</span>
            <span className="text-stone-500">{meal.breakfast}</span>
            <span className="text-stone-500">{meal.lunch}</span>
            <span className="text-stone-500">{meal.dinner}</span>
          </div>
        ))}
      </div>
      <div className="px-4 py-3 bg-stone-50 border-t border-stone-100">
        <div className="flex items-center gap-2 text-xs text-stone-400 mb-2">
          <span className="font-medium text-stone-600">B</span> Breakfast
          <span className="font-medium text-stone-600 ml-2">L</span> Lunch
          <span className="font-medium text-stone-600 ml-2">D</span> Dinner
        </div>
        <button
          onClick={onConfirm}
          disabled={confirming}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium py-2 rounded-xl text-sm transition-colors"
        >
          {confirming ? 'Generating grocery list...' : 'Confirm plan & generate grocery list'}
        </button>
      </div>
    </div>
  )
}

export default function PlannerPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [weekPlanId, setWeekPlanId] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  const startSession = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1)

    const { data: existing } = await supabase
      .from('weekly_plans')
      .select('id, meals, confirmed_at')
      .eq('user_id', user.id)
      .eq('week_start_date', weekStart.toISOString().split('T')[0])
      .single()

    if (existing) {
      setWeekPlanId(existing.id)
      if (existing.confirmed_at) setConfirmed(true)
    } else {
      const { data: newPlan } = await supabase
        .from('weekly_plans')
        .insert({ user_id: user.id, week_start_date: weekStart.toISOString().split('T')[0] })
        .select('id')
        .single()
      if (newPlan) setWeekPlanId(newPlan.id)
    }

    const { data: savedMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(50)

    if (savedMessages && savedMessages.length > 0) {
      setMessages(savedMessages as Message[])
    } else {
      const greeting: Message = {
        role: 'assistant',
        content: "Hi! I'm your meal planning assistant for Pantry & Plan. What are you craving or interested in eating this week? Feel free to be as specific or as general as you'd like — I'll help build a plan around it!",
      }
      setMessages([greeting])
      if (user) {
        await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: greeting.content })
      }
    }
  }, [supabase])

  useEffect(() => { startSession() }, [startSession])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function handleSend() {
    if (!input.trim() || streaming) return

    const userMessage: Message = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setStreaming(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: userMessage.content })
    }

    const assistantMessage: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok) throw new Error('Chat request failed')

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullContent += chunk
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: fullContent }
          return updated
        })
      }

      if (user && fullContent) {
        await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: fullContent })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
        return updated
      })
    }

    setStreaming(false)
  }

  async function handleConfirmPlan(meals: Meal[]) {
    setConfirming(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (weekPlanId) {
      await supabase.from('weekly_plans').update({ meals }).eq('id', weekPlanId)
    }

    try {
      const res = await fetch('/api/generate-grocery-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meals, weekPlanId }),
      })

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`Server error ${res.status}: ${errText}`)
      }

      const data = await res.json()

      if (data.groceryList) {
        setConfirmed(true)
        const confirmMsg: Message = {
          role: 'assistant',
          content: `Your meal plan is confirmed! I've generated your grocery list with ${data.groceryList.length} items${data.totalCost ? ` — estimated total: $${data.totalCost.toFixed(2)}` : ''}. Head to the Grocery List tab to see it!`,
        }
        setMessages(prev => [...prev, confirmMsg])
        await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: confirmMsg.content })
      } else {
        throw new Error(data.error ?? 'No grocery list returned')
      }
    } catch (err) {
      console.error('Grocery list error:', err)
      alert(`Failed to generate grocery list: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    setConfirming(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleReset() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Clear all state immediately
    setMessages([])
    setConfirmed(false)
    setInput('')

    // Delete messages and reset the weekly plan in parallel
    await Promise.all([
      supabase.from('chat_messages').delete().eq('user_id', user.id),
      weekPlanId
        ? supabase.from('weekly_plans').update({
            meals: [],
            grocery_list: [],
            estimated_total_cost: null,
            confirmed_at: null,
          }).eq('id', weekPlanId)
        : Promise.resolve(),
    ])

    // Show fresh greeting
    const greeting: Message = {
      role: 'assistant',
      content: "Hi! I'm your meal planning assistant for Pantry & Plan. What are you craving or interested in eating this week? Feel free to be as specific or as general as you'd like — I'll help build a plan around it!",
    }
    setMessages([greeting])
    await supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: greeting.content })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-stone-800">Weekly Planner</h2>
          <p className="text-stone-400 text-sm mt-0.5">Tell me what you're craving this week</p>
        </div>
        <button onClick={handleReset} className="text-xs text-stone-400 hover:text-stone-600 transition-colors">
          Start over
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg, i) => {
          const mealPlan = msg.role === 'assistant' ? parseMealPlan(msg.content) : null
          const displayContent = msg.content.replace(/MEAL PLAN:[\s\S]*?(?=\n\nIf|$)/, '').trim()

          return (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-1' : ''}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-br-sm'
                    : 'bg-white border border-stone-200 text-stone-800 rounded-bl-sm'
                }`}>
                  {displayContent || (streaming && i === messages.length - 1 ? '...' : '')}
                </div>
                {mealPlan && !confirmed && (
                  <MealPlanCard
                    meals={mealPlan}
                    onConfirm={() => handleConfirmPlan(mealPlan)}
                    confirming={confirming}
                  />
                )}
                {mealPlan && confirmed && (
                  <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm text-emerald-700 font-medium">
                    Plan confirmed — check your Grocery List tab!
                  </div>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border border-stone-200 rounded-2xl p-3 flex gap-3 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="flex-1 resize-none text-sm focus:outline-none text-stone-800 placeholder-stone-400 max-h-32"
          style={{ height: 'auto' }}
          onInput={e => {
            const el = e.currentTarget
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || streaming}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0"
        >
          {streaming ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

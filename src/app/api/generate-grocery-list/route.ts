import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { meals, weekPlanId } = await request.json()

  if (!meals || meals.length === 0) {
    return NextResponse.json({ error: 'No meals provided' }, { status: 400 })
  }

  const { data: prefs } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select('name, quantity, unit')
    .eq('user_id', user.id)
    .is('removed_at', null)

  const pantryList = (pantryItems ?? []).map((i: Record<string, unknown>) => `${i.name} (${i.quantity}${i.unit ? ' ' + i.unit : ''})`).join(', ')
  const householdSize = (prefs?.household_size as number) ?? 1
  const budget = (prefs?.budget_weekly as number) ?? null
  const stores = Array.isArray(prefs?.preferred_stores)
    ? (prefs.preferred_stores as Array<{ name: string; supportsOnlineOrdering?: boolean }>).map(s => s.name).join(', ')
    : ''

  const mealText = meals.map((m: Record<string, unknown>) => `${m.day}: ${m.breakfast} | ${m.lunch} | ${m.dinner}`).join('\n')

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a grocery list generator. You must respond with ONLY a raw JSON array. No markdown. No backticks. No explanation. Start your response with [ and end with ].',
      messages: [
        {
          role: 'user',
          content: `Generate a grocery list for this weekly meal plan for ${householdSize} person(s).

MEAL PLAN:
${mealText}

ALREADY IN PANTRY (skip these): ${pantryList || 'nothing'}
STORES: ${stores || 'any'}
${budget ? `BUDGET: $${budget}/week` : ''}

Respond with ONLY a JSON array. Each item: { "item": string, "quantity": string, "estimatedCost": number, "category": string }`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    console.log('Raw grocery list response:', text.substring(0, 200))

    // Try multiple parsing strategies
    let groceryList = null

    // Strategy 1: direct parse
    try { groceryList = JSON.parse(text) } catch { /* continue */ }

    // Strategy 2: strip code fences then parse
    if (!groceryList) {
      try {
        const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
        groceryList = JSON.parse(stripped)
      } catch { /* continue */ }
    }

    // Strategy 3: extract first [...] block
    if (!groceryList) {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) {
        try { groceryList = JSON.parse(match[0]) } catch { /* continue */ }
      }
    }

    if (!Array.isArray(groceryList) || groceryList.length === 0) {
      console.error('All parse strategies failed. Raw response:', text)
      return NextResponse.json({ error: 'Could not generate grocery list' }, { status: 500 })
    }

    const totalCost = groceryList.reduce((sum: number, item: { estimatedCost?: number }) => sum + (item.estimatedCost ?? 0), 0)

    if (weekPlanId) {
      await supabase
        .from('weekly_plans')
        .update({ grocery_list: groceryList, estimated_total_cost: totalCost, confirmed_at: new Date().toISOString() })
        .eq('id', weekPlanId)
    }

    return NextResponse.json({ groceryList, totalCost: Math.round(totalCost * 100) / 100 })
  } catch (err) {
    console.error('Grocery list generation error:', err)
    return NextResponse.json({ error: 'Could not generate grocery list' }, { status: 500 })
  }
}

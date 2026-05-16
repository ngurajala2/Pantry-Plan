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

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `Generate a consolidated grocery list for this weekly meal plan for ${householdSize} person(s).

MEAL PLAN:
${mealText}

ALREADY IN PANTRY (exclude these or reduce quantities accordingly):
${pantryList || 'Nothing in pantry'}

PREFERRED STORES: ${stores || 'Any'}
${budget ? `WEEKLY BUDGET: $${budget}` : ''}

Return ONLY a valid JSON array like this:
[
  { "item": "chicken breast", "quantity": "2 lbs", "estimatedCost": 8.99, "category": "Meat & Fish" },
  { "item": "spinach", "quantity": "1 bag", "estimatedCost": 3.49, "category": "Produce" }
]

Use realistic average US grocery prices. Exclude items already in the pantry. Group similar items together.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    const groceryList = JSON.parse(jsonMatch[0])
    const totalCost = groceryList.reduce((sum: number, item: { estimatedCost?: number }) => sum + (item.estimatedCost ?? 0), 0)

    // Save to weekly plan
    if (weekPlanId) {
      await supabase
        .from('weekly_plans')
        .update({ grocery_list: groceryList, estimated_total_cost: totalCost, confirmed_at: new Date().toISOString() })
        .eq('id', weekPlanId)
    }

    return NextResponse.json({ groceryList, totalCost: Math.round(totalCost * 100) / 100 })
  } catch {
    return NextResponse.json({ error: 'Could not generate grocery list' }, { status: 500 })
  }
}

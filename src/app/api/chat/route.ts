import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { messages } = await request.json()

  // Load user preferences
  const { data: prefs } = await supabase
    .from('preferences')
    .select('*')
    .eq('user_id', user.id)
    .single()

  // Load expiring pantry items (within 7 days)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const { data: pantryItems } = await supabase
    .from('pantry_items')
    .select('name, category, quantity, unit, expiration_date, estimated_expiration_date')
    .eq('user_id', user.id)
    .is('removed_at', null)
    .or(`expiration_date.lte.${sevenDaysFromNow.toISOString()},estimated_expiration_date.lte.${sevenDaysFromNow.toISOString()}`)

  const expiringItems = pantryItems ?? []

  // Build system prompt
  const systemPrompt = buildSystemPrompt(prefs, expiringItems)

  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

function buildSystemPrompt(prefs: Record<string, unknown> | null, expiringItems: Record<string, unknown>[]) {
  const today = new Date()
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - today.getDay() + 1)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  })

  let prompt = `You are a friendly, knowledgeable meal planning assistant for Pantry & Plan. Your job is to help users plan their weekly meals in a conversational, helpful way.

Today is ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.
The upcoming week runs: ${weekDates[0]} through ${weekDates[6]}.

`

  if (prefs) {
    if (prefs.household_size) prompt += `HOUSEHOLD: Cooking for ${prefs.household_size} person(s).\n`
    if (prefs.meals_per_day) prompt += `MEALS PER DAY: User eats ${prefs.meals_per_day} meal(s) per day — plan accordingly.\n`
    if (prefs.snacks_per_day !== undefined) prompt += `SNACKS PER DAY: User has ${prefs.snacks_per_day} snack(s) per day — include snack suggestions in the plan if more than 0.\n`
    if (prefs.budget_weekly) prompt += `BUDGET: Weekly grocery budget is $${prefs.budget_weekly}${prefs.budget_per_meal ? `, targeting $${prefs.budget_per_meal} per meal` : ''}.\n`
    if (Array.isArray(prefs.allergies) && prefs.allergies.length > 0) prompt += `ALLERGIES (NEVER include these): ${prefs.allergies.join(', ')}.\n`
    if (Array.isArray(prefs.blacklisted_foods) && prefs.blacklisted_foods.length > 0) prompt += `FOODS TO NEVER USE: ${prefs.blacklisted_foods.join(', ')}.\n`
    if (Array.isArray(prefs.health_goals) && prefs.health_goals.length > 0) prompt += `HEALTH GOALS: ${prefs.health_goals.join(', ')}.\n`
    if (Array.isArray(prefs.preferred_stores) && prefs.preferred_stores.length > 0) {
      const storeNames = (prefs.preferred_stores as Array<{ name: string }>).map(s => s.name).join(', ')
      prompt += `PREFERRED STORES: ${storeNames}.\n`
    }
  }

  if (expiringItems.length > 0) {
    const itemList = expiringItems.map((i) => {
      const item = i as { name: string; quantity?: number; unit?: string }
      return `${item.name}${item.quantity ? ` (${item.quantity}${item.unit ? ' ' + item.unit : ''})` : ''}`
    }).join(', ')
    prompt += `\nPANTRY ITEMS EXPIRING SOON (suggest using these): ${itemList}.\n`
  }

  prompt += `
CONVERSATION GUIDELINES:
- Start by asking what the user is craving or interested in eating this week
- If they are vague, ask clarifying questions: How many nights will you cook vs eat out? Any specific occasions? Any cuisines you're feeling?
- Once you have enough info, generate a 7-day meal plan
- Be conversational and friendly, not robotic
- Respect all dietary restrictions and allergies strictly — never suggest forbidden foods
- Try to incorporate expiring pantry items naturally
- Keep meals realistic and practical

MEAL PLAN FORMAT:
When you present the final meal plan, format it exactly like this so it can be parsed:

MEAL PLAN:
Monday: [Breakfast] | [Lunch] | [Dinner]
Tuesday: [Breakfast] | [Lunch] | [Dinner]
Wednesday: [Breakfast] | [Lunch] | [Dinner]
Thursday: [Breakfast] | [Lunch] | [Dinner]
Friday: [Breakfast] | [Lunch] | [Dinner]
Saturday: [Breakfast] | [Lunch] | [Dinner]
Sunday: [Breakfast] | [Lunch] | [Dinner]

If a meal is "Eating out" just write "Eating out" for that meal slot.
After the meal plan, ask the user if they'd like to confirm it to generate their grocery list.`

  return prompt
}

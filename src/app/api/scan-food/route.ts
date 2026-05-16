import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request: NextRequest) {
  const { imageBase64, mediaType } = await request.json()

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType ?? 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `You are a food freshness expert. Analyze this food item and respond with ONLY a valid JSON object in this exact format:
{
  "name": "food item name (be specific, e.g. 'Roma tomatoes' not just 'tomatoes')",
  "category": "one of: Produce, Dairy, Meat & Fish, Cooked / Leftovers, Dry Goods, Frozen, Canned Goods, Beverages, Condiments, Snacks, Other",
  "freshness": "fresh | use_soon | toss",
  "freshnessNote": "one short sentence explaining the visual assessment",
  "disclaimer": true
}

Be honest about freshness. If the item looks borderline, say use_soon. If it looks spoiled, say toss. This is a visual estimate only.`,
          },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found')
    const result = JSON.parse(jsonMatch[0])
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'Could not parse food analysis' }, { status: 500 })
  }
}

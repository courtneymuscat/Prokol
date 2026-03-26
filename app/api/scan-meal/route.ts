import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  try {
    const { image, mimeType } = await req.json()

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${image}`, detail: 'low' },
            },
            {
              type: 'text',
              text: `Analyze this meal photo and identify every distinct food item visible.

Return ONLY a valid JSON array — no explanation, no markdown:
[{"food_name":"string","grams":number,"calories":number,"protein":number,"carbs":number,"fat":number}]

Rules:
- Be specific (e.g. "Grilled chicken breast" not "meat")
- Estimate portion size visually in grams
- Round calories to nearest 5, macros to 1 decimal place
- If you cannot identify any food, return []`,
            },
          ],
        },
      ],
    })

    const text = response.choices[0].message.content ?? ''
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) return NextResponse.json({ items: [] })

    const items = JSON.parse(match[0])
    return NextResponse.json({ items })
  } catch (err) {
    console.error('scan-meal error:', err)
    return NextResponse.json({ error: 'Failed to analyse image' }, { status: 500 })
  }
}

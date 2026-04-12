export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const HEADERS = (key) => ({
  'Content-Type': 'application/json',
  'x-api-key': key,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'pdfs-2024-09-25',
})

async function callClaude(key, body) {
  const res = await fetch(ANTHROPIC_API, {
    method: 'POST',
    headers: HEADERS(key),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[api/chat] Claude status:', res.status, 'stop_reason:', data.stop_reason, 'error:', data.error || 'none')
  return { status: res.status, data }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const key = process.env.ANTHROPIC_KEY
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_KEY not set' })

  try {
    const { model, max_tokens, messages, system, lehrplan } = req.body

    // ── Lehrplan two-step: web_search + card generation ──────────────────────
    if (lehrplan) {
      const { topic, label, country, year } = lehrplan
      console.log('[api/chat] Lehrplan mode — topic:', label, 'country:', country, 'year:', year)

      // Step 1: web_search for current official curriculum
      const searchQuery = `official ${label} curriculum requirements ${country} ${year} exam topics`
      const searchBody = {
        model: 'claude-opus-4-6',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{
          role: 'user',
          content: `Search for: "${searchQuery}". Find the current official ${label} exam curriculum in ${country} for ${year}. What are the key topics tested? Summarize the main subject areas and important content.`,
        }],
      }

      console.log('[api/chat] Step 1: web_search for curriculum…')
      let searchContext = ''
      try {
        const searchRes = await callClaude(key, searchBody)
        if (searchRes.data.error) {
          console.warn('[api/chat] web_search failed:', searchRes.data.error.message)
          searchContext = '' // fall through to step 2 without search context
        } else {
          // Extract text from tool_result or text blocks
          const blocks = searchRes.data.content || []
          const textParts = blocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
          searchContext = textParts.join('\n').slice(0, 3000)
          console.log('[api/chat] Step 1 done, context chars:', searchContext.length)
        }
      } catch (e) {
        console.warn('[api/chat] Step 1 web_search error (continuing without):', e.message)
      }

      // Step 2: Generate flashcards using search results as context
      const contextPart = searchContext
        ? `\n\nOfficial curriculum research results:\n${searchContext}\n\nBased on this research, `
        : ''
      const cardPrompt = `You are an expert teacher preparing students for ${label} in ${country}.${contextPart}Generate 15 flashcards covering the most important exam-relevant topics for ${label} in ${country} (${year}). Cards must be in German. Focus on content students are most likely to be tested on.

Return ONLY a valid JSON array. No markdown. No explanation. No backticks. Start with [ and end with ]:
[{"front":"...","back":"...","backShort":"..."}]`

      console.log('[api/chat] Step 2: generating cards…')
      const cardBody = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: cardPrompt }],
      }
      const cardRes = await callClaude(key, cardBody)
      return res.status(cardRes.status).json(cardRes.data)
    }

    // ── Standard pass-through proxy ──────────────────────────────────────────
    console.log('[api/chat] Standard proxy — model:', model, 'messages:', messages?.length)
    const body = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: max_tokens || 4000,
      messages: messages || [],
      ...(system ? { system } : {}),
    }
    const { status, data } = await callClaude(key, body)
    return res.status(status).json(data)

  } catch (e) {
    console.error('[api/chat] Proxy error:', e)
    return res.status(500).json({ error: 'Proxy error', details: e.message })
  }
}

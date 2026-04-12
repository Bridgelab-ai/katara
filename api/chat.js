export const config = { api: { bodyParser: { sizeLimit: '20mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { model, max_tokens, messages, system, fileContent, fileBase64, fileType } = req.body

    // Build message content
    let content = []

    // If caller already passed a full messages array with content, use it directly
    if (messages && messages.length > 0 && !fileContent && !fileBase64) {
      // Pass through as-is (existing callers that build their own content array)
      const body = {
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: max_tokens || 4000,
        messages,
        ...(system ? { system } : {}),
      }
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'pdfs-2024-09-25',
        },
        body: JSON.stringify(body),
      })
      const data = await response.json()
      return res.status(response.status).json(data)
    }

    // Simple file-based request (fileContent or fileBase64)
    if (fileBase64 && fileType) {
      // PDF or binary — send as document block
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: fileType, data: fileBase64 },
      })
    } else if (fileContent) {
      // Plain text file
      content.push({ type: 'text', text: fileContent })
    }

    // Append user instruction from messages[0] if present
    const userText = messages?.[0]?.content
    if (typeof userText === 'string' && userText.trim()) {
      content.push({ type: 'text', text: userText })
    } else if (typeof userText !== 'string' && Array.isArray(userText)) {
      content = [...content, ...userText]
    }

    const systemPrompt = system ||
      'Return ONLY a valid JSON array. No markdown. No explanation. No backticks. Start with [ and end with ].'

    const body = {
      model: model || 'claude-haiku-4-5-20251001',
      max_tokens: max_tokens || 4000,
      system: systemPrompt,
      messages: [{ role: 'user', content: content.length > 0 ? content : (messages || []) }],
    }

    console.log('[api/chat] Sending to Anthropic, model:', body.model, 'content blocks:', content.length)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    console.log('[api/chat] Response status:', response.status, 'error:', data.error || 'none')
    return res.status(response.status).json(data)
  } catch (e) {
    console.error('[api/chat] Proxy error:', e)
    return res.status(500).json({ error: 'Proxy error', details: e.message })
  }
}

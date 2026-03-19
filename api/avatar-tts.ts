/**
 * POST /api/avatar-tts
 * Generate TTS for avatar message. If ELEVENLABS_API_KEY set, returns audio URL or stream; else 501.
 * Body: { text, voice_id? }
 */
const elevenKey = process.env.ELEVENLABS_API_KEY
const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || ''

export default async function handler(
  req: { method?: string; body?: { text?: string; voice_id?: string } },
  res: { status: (n: number) => { json: (o: object) => void; setHeader: (k: string, v: string) => void }; setHeader: (a: string, b: string) => void }
): Promise<void> {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const { text, voice_id } = req.body || {}
  if (!text) {
    res.status(400).json({ error: 'Missing text' })
    return
  }
  if (!elevenKey) {
    res.status(501).json({ error: 'ElevenLabs not configured. Set ELEVENLABS_API_KEY.' })
    return
  }
  const voice = voice_id || defaultVoiceId
  if (!voice) {
    res.status(400).json({ error: 'No voice_id. Set ELEVENLABS_VOICE_ID or pass voice_id.' })
    return
  }
  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenKey,
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) {
      const err = await response.text()
      res.status(response.status).json({ error: err || 'ElevenLabs error' })
      return
    }
    const audioBuffer = await response.arrayBuffer()
    const resAny = res as unknown as {
      status: (n: number) => void
      setHeader: (a: string, b: string) => void
      end: (b?: Buffer) => void
    }
    resAny.status(200)
    resAny.setHeader('Content-Type', 'audio/mpeg')
    resAny.end(Buffer.from(audioBuffer))
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
}

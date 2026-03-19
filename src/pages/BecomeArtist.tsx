import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { AI_FEATURES_ENABLED } from '../lib/features'
import { fetchArtistBioFromWeb, polishArtistBioDraft } from '../lib/bioResearch'

export function BecomeArtist() {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [showAiProfile, setShowAiProfile] = useState(false)
  const [aiName, setAiName] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [bio, setBio] = useState('')
  const [bioResearchLoading, setBioResearchLoading] = useState(false)
  const [bioPolishLoading, setBioPolishLoading] = useState(false)
  const [bioNotice, setBioNotice] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) {
        navigate('/dashboard', { replace: true })
      }
    })
  }, [user, navigate])

  if (!user) {
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)
    const { error } = await supabase.from('artists').insert({
      user_id: user.id,
      display_name: displayName || profile?.full_name || 'Artist',
      handle: handle || null,
      avatar_url: profile?.avatar_url ?? null,
      bio: bio.trim() || null,
    })
    setLoading(false)
    if (error) {
      if (error.code === '23505' && error.message?.includes('artists_user_id_key')) {
        await supabase.from('users').update({ role: 'artist' }).eq('id', user.id)
        await refreshProfile()
        navigate('/dashboard', { replace: true })
        return
      }
      setMessage({ type: 'error', text: error.message })
      return
    }
    await supabase.from('users').update({ role: 'artist' }).eq('id', user.id)
    await refreshProfile()
    setMessage({ type: 'success', text: "You're now an artist." })
    navigate('/onboarding', { replace: true })
  }

  const handleGenerateProfile = () => {
    if (!aiName.trim()) return
    setAiGenerating(true)
    setShowAiProfile(true)
    const name = aiName.trim()
    const slug = name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')
    setTimeout(() => {
      setDisplayName(name)
      setHandle(slug ? `@${slug}` : handle)
      setAiGenerating(false)
      setShowAiProfile(false)
      setAiName('')
    }, 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Become an artist
        </h1>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-6">
          Create your artist profile to go live and sell.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]"
          />
          <input
            type="text"
            placeholder="Handle (optional)"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]"
          />
          <div>
            <label className="block text-xs font-medium text-[var(--signal-ink-muted)] mb-1.5">About (optional)</label>
            <p className="text-[11px] text-[var(--signal-ink-muted)] mb-1.5 leading-snug">
              Jot rough notes — <span className="text-[var(--signal-ink)]">Refine</span> cleans it up with AI.{' '}
              <span className="text-[var(--signal-ink)]">Web</span> only if you’re already listed online.
            </p>
            {bioNotice && <p className="text-xs text-[var(--signal-ink-muted)] mb-1">{bioNotice}</p>}
            <textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value)
                setBioNotice(null)
              }}
              placeholder="e.g. Detroit techno, monthly residency, self-released EPs…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={bioPolishLoading || bioResearchLoading}
                onClick={async () => {
                  setBioNotice(null)
                  setBioPolishLoading(true)
                  const r = await polishArtistBioDraft(bio, displayName.trim() || profile?.full_name || undefined)
                  setBioPolishLoading(false)
                  if (!r.ok) {
                    setBioNotice(r.error)
                    return
                  }
                  setBio(r.text)
                  setBioNotice('Refined — edit if you like.')
                }}
                className="text-xs text-[var(--signal-ink)] font-medium border-b border-[var(--signal-silver-light)] pb-0.5 hover:border-[var(--signal-gold)] disabled:opacity-40"
              >
                {bioPolishLoading ? 'Refining…' : 'Refine'}
              </button>
              <button
                type="button"
                disabled={bioResearchLoading || bioPolishLoading || (!displayName.trim() && !profile?.full_name?.trim())}
                onClick={async () => {
                  setBioNotice(null)
                  setBioResearchLoading(true)
                  const q = displayName.trim() || profile?.full_name?.trim() || ''
                  const r = await fetchArtistBioFromWeb(q)
                  setBioResearchLoading(false)
                  if (!r.ok) {
                    setBioNotice(r.error)
                    return
                  }
                  if (r.summary) {
                    setBio(r.summary)
                    setBioNotice(`From ${r.source === 'perplexity' ? 'web sources' : 'public records'} — edit before continuing.`)
                  } else {
                    const hint = r.source === 'none' ? r.message : undefined
                    setBioNotice(hint ?? 'No match. Use Refine or write your own.')
                  }
                }}
                className="text-xs text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] pb-0.5 hover:border-[var(--signal-gold)] hover:text-[var(--signal-ink)] disabled:opacity-40"
              >
                {bioResearchLoading ? 'Looking up…' : 'From web'}
              </button>
            </div>
          </div>
          {AI_FEATURES_ENABLED && (
            <p className="text-center">
              <button
                type="button"
                onClick={() => setShowAiProfile(true)}
                className="text-xs text-[var(--signal-ink-muted)] tracking-wide uppercase border-b border-[var(--signal-silver-light)] pb-0.5 hover:border-[var(--signal-gold)] hover:text-[var(--signal-ink)] transition-colors"
              >
                Suggest name & handle
              </button>
            </p>
          )}
          {message && (
            <p className={message.type === 'error' ? 'text-red-600' : 'text-[var(--signal-gold)]'}>
              {message.text}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Continue as artist'}
          </button>
        </form>
      </div>

      {AI_FEATURES_ENABLED && showAiProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !aiGenerating && setShowAiProfile(false)}>
          <div className="bg-[var(--signal-white-pure)] rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Suggest name & handle
            </h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4 leading-relaxed">
              Enter a stage name. We’ll fill display name and a simple handle you can edit.
            </p>
            <input
              type="text"
              placeholder="e.g. DJ Nova"
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[var(--signal-silver-light)] bg-white text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)] mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleGenerateProfile}
                disabled={aiGenerating || !aiName.trim()}
                className="flex-1 py-2 rounded-xl bg-[var(--signal-gold)] text-white text-sm font-medium disabled:opacity-50"
              >
                {aiGenerating ? 'Generating…' : 'Generate'}
              </button>
              <button
                type="button"
                onClick={() => setShowAiProfile(false)}
                disabled={aiGenerating}
                className="py-2 px-4 rounded-xl border border-[var(--signal-silver-light)] text-sm text-[var(--signal-ink-muted)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

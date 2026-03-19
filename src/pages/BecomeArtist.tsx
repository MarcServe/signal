import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const AI_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_AI_FEATURES !== 'false'

export function BecomeArtist() {
  const { user, profile, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [handle, setHandle] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [showAiProfile, setShowAiProfile] = useState(false)
  const [aiName, setAiName] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
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
          {AI_FEATURES_ENABLED && (
            <p className="text-xs text-[var(--signal-ink-muted)]">
              <button
                type="button"
                onClick={() => setShowAiProfile(true)}
                className="text-[var(--signal-gold)] hover:opacity-80 underline"
              >
                Generate profile from name
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
              Generate profile from name
            </h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4">
              Enter an artist or stage name. We’ll suggest display name and handle. (MVP: local suggestion; full version can pull from the web.)
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

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function SettingsPrivacy() {
  const { user, profile, loading: authLoading } = useAuth()
  const [artistId, setArtistId] = useState<string | null>(null)
  const [online, setOnline] = useState(true)
  const [loadingArtist, setLoadingArtist] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const isArtist = profile?.role === 'artist'

  useEffect(() => {
    if (authLoading || !user || !isArtist) {
      setLoadingArtist(false)
      return
    }
    let cancelled = false
    setLoadingArtist(true)
    setFetchError(null)
    supabase
      .from('artists')
      .select('id, profile_visible')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setLoadingArtist(false)
        if (error) {
          setArtistId(null)
          const hint =
            error.message?.includes('profile_visible') || (error as { code?: string }).code === '42703'
              ? ' Run supabase/migrations/00007_profile_visible.sql in the Supabase SQL Editor, then refresh.'
              : ''
          setFetchError(`${error.message}${hint}`)
          return
        }
        if (!data?.id) {
          setArtistId(null)
        } else {
          setArtistId(data.id)
          setOnline((data as { profile_visible?: boolean }).profile_visible !== false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, isArtist])

  const setVisibility = async (nextOnline: boolean) => {
    if (!user || !artistId) return
    setSaving(true)
    setMessage(null)
    const prev = online
    setOnline(nextOnline)
    const { error } = await supabase.from('artists').update({ profile_visible: nextOnline }).eq('id', artistId).eq('user_id', user.id)
    setSaving(false)
    if (error) {
      setOnline(prev)
      setMessage({ type: 'err', text: error.message })
      return
    }
    setMessage({
      type: 'ok',
      text: nextOnline
        ? 'You’re online — fans can find you on discovery and your public profile.'
        : 'You’re offline — your public profile and catalogue are hidden until you go online again.',
    })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <p className="mb-4">
        <Link
          to="/settings"
          className="text-sm text-[var(--signal-ink-muted)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-ink)] transition-colors"
        >
          ← Settings
        </Link>
      </p>
      <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
        Privacy
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6 text-sm leading-relaxed">
        How we handle your data on Signal.
      </p>

      {!authLoading && !user && (
        <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-sm text-[var(--signal-ink-muted)]">
          <Link to="/login" className="text-[var(--signal-ink)] border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-gold)]">
            Sign in
          </Link>{' '}
          to manage visibility.
        </div>
      )}

      {user && !isArtist && (
        <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-sm text-[var(--signal-ink-muted)] leading-relaxed">
          <p className="mb-2">Online / offline visibility applies to artist profiles.</p>
          <Link
            to="/become-artist"
            className="text-[var(--signal-ink)] font-medium border-b border-[var(--signal-silver-light)] hover:border-[var(--signal-gold)]"
          >
            Become an artist
          </Link>
          <span> to control when you’re visible on discovery and your public page.</span>
        </div>
      )}

      {user && isArtist && (
        <section className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 mb-6">
          <h2 className="text-sm font-semibold text-[var(--signal-ink)] uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            Profile visibility
          </h2>
          <p className="text-sm text-[var(--signal-ink-muted)] mb-5 leading-relaxed">
            Choose when your artist profile appears to everyone else. You can always use your dashboard while signed in.
          </p>

          {loadingArtist ? (
            <p className="text-sm text-[var(--signal-ink-muted)]">Loading…</p>
          ) : fetchError ? (
            <p className="text-sm text-red-600 leading-relaxed">{fetchError}</p>
          ) : !artistId ? (
            <p className="text-sm text-[var(--signal-ink-muted)]">
              No artist profile found.{' '}
              <Link to="/become-artist" className="text-[var(--signal-gold)] hover:opacity-80">
                Complete setup
              </Link>
            </p>
          ) : (
            <>
              <div
                className="flex rounded-xl border border-[var(--signal-silver-light)] p-1 bg-[var(--signal-silver-light)]/20"
                role="group"
                aria-label="Profile online or offline"
              >
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setVisibility(true)}
                  className={`flex-1 py-3 px-3 rounded-lg text-sm font-medium transition-colors ${
                    online
                      ? 'bg-[var(--signal-white-pure)] text-[var(--signal-ink)] shadow-sm ring-1 ring-black/5'
                      : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]'
                  }`}
                >
                  Online
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setVisibility(false)}
                  className={`flex-1 py-3 px-3 rounded-lg text-sm font-medium transition-colors ${
                    !online
                      ? 'bg-[var(--signal-white-pure)] text-[var(--signal-ink)] shadow-sm ring-1 ring-black/5'
                      : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]'
                  }`}
                >
                  Offline
                </button>
              </div>
              <p className="mt-3 text-xs text-[var(--signal-ink-muted)] leading-relaxed">
                <strong className="text-[var(--signal-ink)] font-medium">Online</strong> — discovery feed, your public profile link, and shared catalogue are visible.{' '}
                <strong className="text-[var(--signal-ink)] font-medium">Offline</strong> — hidden from others; only you can load your profile when signed in.
              </p>
              {saving && <p className="mt-2 text-xs text-[var(--signal-ink-muted)]">Saving…</p>}
              {message && (
                <p
                  className={`mt-3 text-sm ${message.type === 'err' ? 'text-red-600' : 'text-[var(--signal-ink-muted)]'}`}
                  role="status"
                >
                  {message.text}
                </p>
              )}
            </>
          )}
        </section>
      )}

      <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] p-6 text-sm text-[var(--signal-ink-muted)] space-y-3 leading-relaxed">
        <p>
          We use your account information to run the app and show your public artist profile when you’re online and visible.
        </p>
        <p>
          After you run the database migration that adds <code className="text-xs text-[var(--signal-ink)]">profile_visible</code>, going offline also hides your rows from the public discovery feed for other visitors.
        </p>
        <p>Detailed export tools and more controls will appear here as the product grows.</p>
      </div>
    </div>
  )
}

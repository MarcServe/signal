import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function SettingsAccount() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [fullNameDraft, setFullNameDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoNotice, setPhotoNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setFullNameDraft(profile?.full_name ?? '')
  }, [profile?.full_name, profile?.id])

  useEffect(() => {
    if (typeof window === 'undefined' || window.location.hash !== '#profile-photo') return
    requestAnimationFrame(() => {
      document.getElementById('profile-photo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

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
        Account
      </h1>
      <p className="text-[var(--signal-ink-muted)] mb-6 text-sm leading-relaxed">
        Profile, portrait, and studio tools.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--signal-ink-muted)]">Loading…</p>
      ) : (
        <div className="rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] divide-y divide-[var(--signal-silver-light)]">
          <div className="px-4 py-4">
            <p className="text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">Email</p>
            <p className="text-sm text-[var(--signal-ink)] mt-1">{profile?.email ?? '—'}</p>
          </div>
          <form
            className="px-4 py-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!user?.id) return
              setSaving(true)
              setNotice(null)
              const name = fullNameDraft.trim() || null
              const { error } = await supabase.from('users').update({ full_name: name }).eq('id', user.id)
              setSaving(false)
              if (error) {
                setNotice({ type: 'err', text: error.message })
                return
              }
              await refreshProfile()
              setNotice({ type: 'ok', text: 'Saved.' })
            }}
          >
            <label className="block text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
              Display name
            </label>
            <p className="text-[11px] text-[var(--signal-ink-muted)] leading-snug">
              {profile?.role === 'artist'
                ? 'Shown in the app header and account. Your public artist name is edited on the dashboard (and stays in sync when you save there).'
                : 'How you appear in the app.'}
            </p>
            <input
              type="text"
              value={fullNameDraft}
              onChange={(e) => {
                setFullNameDraft(e.target.value)
                setNotice(null)
              }}
              placeholder="Your name"
              className="w-full rounded-xl border border-[var(--signal-silver-light)] bg-white px-3 py-2.5 text-sm text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]/40"
            />
            {notice && (
              <p className={`text-sm ${notice.type === 'err' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`} role="status">
                {notice.text}
              </p>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save display name'}
            </button>
          </form>
          {profile?.role === 'artist' ? (
            <Link
              to="/avatar/create"
              className="flex items-center justify-between px-4 py-3 text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal-gold)]/40"
            >
              <span>Portrait &amp; studio photo</span>
              <span className="text-[var(--signal-ink-muted)]" aria-hidden>
                ›
              </span>
            </Link>
          ) : (
            <div id="profile-photo" className="px-4 py-4 space-y-3">
              <p className="text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">Profile photo</p>
              <p className="text-[11px] text-[var(--signal-ink-muted)] leading-snug">
                Used in the app header and your account. This is not your public artist portrait (fans don’t have a discovery card).
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <div className="h-16 w-16 rounded-full overflow-hidden border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/40 shrink-0">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[10px] text-[var(--signal-ink-muted)] text-center px-1">
                      No photo
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      e.target.value = ''
                      if (!file || !user?.id) return
                      setPhotoUploading(true)
                      setPhotoNotice(null)
                      const path = `profiles/${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'jpg'}`
                      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
                      if (upErr) {
                        setPhotoUploading(false)
                        setPhotoNotice({ type: 'err', text: upErr.message })
                        return
                      }
                      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
                      const { error: uErr } = await supabase
                        .from('users')
                        .update({ avatar_url: urlData.publicUrl })
                        .eq('id', user.id)
                      setPhotoUploading(false)
                      if (uErr) {
                        setPhotoNotice({ type: 'err', text: uErr.message })
                        return
                      }
                      await refreshProfile()
                      setPhotoNotice({ type: 'ok', text: 'Photo updated.' })
                    }}
                  />
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 disabled:opacity-50"
                  >
                    {photoUploading ? 'Uploading…' : 'Upload photo'}
                  </button>
                </div>
              </div>
              {photoNotice && (
                <p
                  className={`text-sm ${photoNotice.type === 'err' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}
                  role="status"
                >
                  {photoNotice.text}
                </p>
              )}
            </div>
          )}
          {profile?.role === 'artist' && (
            <Link
              to="/dashboard"
              className="flex items-center justify-between px-4 py-3 text-sm text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/35 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--signal-gold)]/40"
            >
              <span>Artist dashboard</span>
              <span className="text-[var(--signal-ink-muted)]" aria-hidden>
                ›
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

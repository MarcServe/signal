import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'
export function AvatarCreate() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [latestUploadUrl, setLatestUploadUrl] = useState<string | null>(null)
  const [artistId, setArtistId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  /** Local blob URL while a new file is uploading (revoked after upload ends). */
  const [pickerPreview, setPickerPreview] = useState<string | null>(null)
  const [refineTab, setRefineTab] = useState<'auto' | 'custom'>('auto')
  const [customInstruction, setCustomInstruction] = useState('')

  // Never redirect while profile is still loading — `profile?.role !== 'artist'` is true when profile is null,
  // which previously sent artists to `/` before they could upload.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    if (profile && profile.role !== 'artist') {
      navigate('/', { replace: true })
    }
  }, [authLoading, user, profile, navigate])

  // Preload artist row so Enhance works for avatars already saved on the profile (not only after a fresh upload).
  useEffect(() => {
    if (!user?.id || profile?.role !== 'artist') return
    let cancelled = false
    void supabase
      .from('artists')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.id) setArtistId(data.id)
      })
    return () => {
      cancelled = true
    }
  }, [user?.id, profile?.role])

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        <p className="text-[var(--signal-ink-muted)]" style={{ fontFamily: 'var(--font-body)' }}>
          Loading…
        </p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
        <p className="text-[var(--signal-ink-muted)] text-center text-sm">Couldn’t load your profile. Try signing out and back in.</p>
      </div>
    )
  }

  if (profile.role !== 'artist') {
    return null
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    setPickerPreview(objectUrl)
    setUploading(true)
    setMessage(null)
    try {
      const artistRes = await supabase.from('artists').select('id').eq('user_id', user.id).single()
      if (artistRes.error || !artistRes.data) {
        setMessage({ type: 'error', text: `Artist profile not found: ${artistRes.error?.message ?? 'No artist row for this user.'}` })
        return
      }
      const artistRowId = artistRes.data.id
      setArtistId(artistRowId)
      const path = `avatars/${artistRowId}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'jpg'}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) {
        setMessage({ type: 'error', text: `Storage upload failed: ${uploadError.message}` })
        return
      }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const imageUrl = urlData.publicUrl
      setLatestUploadUrl(imageUrl)

      const session = await getSession()
      if (!session) {
        setMessage({ type: 'error', text: 'Session expired. Sign in again and retry upload.' })
        return
      }

      // Storage upload already succeeded — always persist avatar_url to users/artists.
      // The API syncs server-side history; if it fails (e.g. missing SUPABASE_SERVICE_ROLE_KEY on Vercel),
      // the profile must still update so the live site shows the new image.
      let savedImageUrl = imageUrl
      let serverAvatarSynced = true
      try {
        const apiRes = await fetch(apiUrl('/avatar-generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ artist_id: artistRowId, image_url: imageUrl }),
        })
        const raw = await apiRes.text()
        let apiJson: { error?: string; image_url?: string } = {}
        try {
          apiJson = raw ? (JSON.parse(raw) as typeof apiJson) : {}
        } catch {
          apiJson = {}
        }
        const jsonLike =
          apiRes.headers.get('content-type')?.includes('application/json') || raw.trim().startsWith('{')
        if (apiRes.ok && jsonLike) {
          savedImageUrl = apiJson.image_url ?? imageUrl
        } else if (
          import.meta.env.DEV &&
          (!jsonLike || apiRes.status === 404 || apiRes.status === 405)
        ) {
          // Frontend-only dev server may lack app API routes; use full-stack dev or deployed app.
          savedImageUrl = imageUrl
          serverAvatarSynced = false
        } else {
          savedImageUrl = imageUrl
          serverAvatarSynced = false
        }
      } catch {
        savedImageUrl = imageUrl
        serverAvatarSynced = false
      }

      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ avatar_setup_done: true, avatar_url: savedImageUrl })
        .eq('id', user.id)
      if (userUpdateError) {
        setMessage({ type: 'error', text: `Avatar uploaded, but profile update failed: ${userUpdateError.message}` })
        return
      }

      // Home feed uses artists.avatar_url in feed_items_view — keep it in sync with users.avatar_url
      await supabase.from('artists').update({ avatar_url: savedImageUrl }).eq('user_id', user.id)

      await refreshProfile()
      setMessage({
        type: 'success',
        text: serverAvatarSynced
          ? 'Saved.'
          : import.meta.env.DEV
            ? 'Saved locally. Run the app with API routes enabled for full server sync.'
            : 'Saved to your profile. If the image doesn’t appear everywhere, hard-refresh the page. (Optional: set server env for full sync — see README.)',
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unexpected upload error.'
      setMessage({ type: 'error', text: msg })
    } finally {
      URL.revokeObjectURL(objectUrl)
      setPickerPreview(null)
      setUploading(false)
    }
  }

  const handleEnhanceLatest = async (enhanceInstruction?: string) => {
    // Preview can show profile.avatar_url; Enhance previously only looked at latestUploadUrl (set on new upload).
    const imageUrlForEnhance = latestUploadUrl ?? profile.avatar_url ?? null
    if (!imageUrlForEnhance?.trim()) {
      setMessage({ type: 'error', text: 'Add an avatar image first (upload a photo above).' })
      return
    }

    let resolvedArtistId = artistId
    if (!resolvedArtistId) {
      const { data: artistRow, error: artistErr } = await supabase
        .from('artists')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (artistErr || !artistRow?.id) {
        setMessage({
          type: 'error',
          text: artistErr?.message ?? 'Artist profile not found. Complete artist setup first.',
        })
        return
      }
      resolvedArtistId = artistRow.id
      setArtistId(artistRow.id)
    }

    setEnhancing(true)
    setMessage(null)
    try {
      const session = await getSession()
      if (!session) {
        setMessage({ type: 'error', text: 'Session expired. Sign in again and retry.' })
        return
      }
      let apiRes: Response
      try {
        const trimmedInstr = enhanceInstruction?.trim()
        const viteProvider = import.meta.env.VITE_AVATAR_ENHANCE_PROVIDER?.trim().toLowerCase()
        const providerField =
          viteProvider === 'openai' || viteProvider === 'gemini'
            ? { provider: viteProvider as 'openai' | 'gemini' }
            : {}
        apiRes = await fetch(apiUrl('/avatar-generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            artist_id: resolvedArtistId,
            image_url: imageUrlForEnhance,
            mode: 'enhance',
            ...providerField,
            ...(trimmedInstr ? { enhance_instruction: trimmedInstr.slice(0, 800) } : {}),
          }),
        })
      } catch {
        setMessage({
          type: 'error',
          text: import.meta.env.DEV
            ? 'Can’t reach the local backend. Use your project’s full-stack dev command so app APIs are running, then try again.'
            : 'Can’t reach our servers right now. Try again in a moment.',
        })
        return
      }
      const raw = await apiRes.text()
      let apiJson = {} as { error?: string; image_url?: string; warning?: string }
      try {
        if (raw.trim()) apiJson = JSON.parse(raw) as typeof apiJson
      } catch {
        /* non-JSON error body */
      }
      if (!apiRes.ok) {
        if (apiRes.status === 502 || apiRes.status === 504) {
          setMessage({
            type: 'error',
            text: import.meta.env.DEV
              ? 'The local backend isn’t responding. Start your full-stack dev server and try again.'
              : 'Our service is busy. Try again in a moment.',
          })
          return
        }
        const detail =
          apiRes.status === 404 && import.meta.env.DEV
            ? ' If you’re developing locally, start the app’s backend/API process and try again.'
            : ''
        const serverMsg = apiJson.error || (raw.trim() ? raw.slice(0, 280) : '') || `HTTP ${apiRes.status}`
        setMessage({
          type: 'error',
          text: `Enhance failed: ${serverMsg}.${detail}`,
        })
        return
      }
      const finalImageUrl = apiJson.image_url ?? imageUrlForEnhance
      setLatestUploadUrl(finalImageUrl)
      await supabase.from('users').update({ avatar_url: finalImageUrl, avatar_setup_done: true }).eq('id', user.id)
      await supabase.from('artists').update({ avatar_url: finalImageUrl }).eq('user_id', user.id)
      await refreshProfile()
      setMessage({
        type: 'success',
        text: apiJson.warning ? `Refinement saved. (${apiJson.warning})` : 'Refinement saved.',
      })
    } catch (err) {
      const failedFetch =
        err instanceof TypeError ||
        (err instanceof Error && /network|fetch|failed|refused|load/i.test(err.message))
      setMessage({
        type: 'error',
        text: failedFetch
          ? import.meta.env.DEV
            ? 'Can’t reach the local backend. Start your full-stack dev server and try again.'
            : 'Can’t reach our servers right now. Try again in a moment.'
          : err instanceof Error
            ? err.message
            : 'Enhance request failed.',
      })
    } finally {
      setEnhancing(false)
    }
  }

  const previewSrc = pickerPreview ?? latestUploadUrl ?? profile.avatar_url ?? null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Portrait
        </h1>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-6 leading-relaxed">
          One image for your public profile and discovery cards. Shown in a tall portrait frame (not a square crop on the feed).
        </p>
        {previewSrc && (
          <div className="mb-6 flex flex-col gap-2">
            <p className="text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
              {pickerPreview ? 'Preview' : 'Your portrait'}
            </p>
            <div className="relative w-full max-w-xs mx-auto sm:mx-0 aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/15 shadow-sm ring-1 ring-black/5">
              <img
                src={previewSrc}
                alt={pickerPreview ? 'Selected image preview' : 'Your portrait'}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        )}
        <label className="block w-full py-8 border-2 border-dashed border-[var(--signal-silver-light)] rounded-xl text-center text-[var(--signal-ink-muted)] cursor-pointer hover:border-[var(--signal-gold)] hover:text-[var(--signal-gold)]">
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          {uploading ? 'Uploading…' : 'Choose image'}
        </label>

        {/* Collapsed by default — AI portrait refinement */}
        <details className="group/refine mt-6 rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] overflow-hidden">
          <summary className="cursor-pointer select-none list-none px-4 py-3.5 flex items-center justify-between gap-3 text-sm font-semibold text-[var(--signal-ink)] hover:bg-[var(--signal-silver-light)]/15 [&::-webkit-details-marker]:hidden" style={{ fontFamily: 'var(--font-display)' }}>
            <span>Portrait refinement</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-normal text-[var(--signal-ink-muted)] group-open/refine:hidden">Expand</span>
              <span className="text-[11px] font-normal text-[var(--signal-ink-muted)] hidden group-open/refine:inline">Collapse</span>
            </span>
          </summary>
          <div className="px-4 pb-4 pt-0 border-t border-[var(--signal-silver-light)]/70">
            <p className="pt-3 text-xs text-[var(--signal-ink-muted)] leading-relaxed">
              Uses your server’s <strong className="text-[var(--signal-ink)]">OPENAI_API_KEY</strong> (default) or{' '}
              <strong className="text-[var(--signal-ink)]">GEMINI_API_KEY</strong>. Set{' '}
              <code className="text-[10px] bg-[var(--signal-silver-light)]/50 px-1 rounded">VITE_AVATAR_ENHANCE_PROVIDER=gemini</code>{' '}
              or <code className="text-[10px] bg-[var(--signal-silver-light)]/50 px-1 rounded">openai</code> to force one provider.
              Local dev needs the API backend running (<code className="text-[10px]">vercel dev</code> or equivalent).
            </p>
            <div className="mt-4 flex rounded-xl border border-[var(--signal-silver-light)] overflow-hidden p-0.5 bg-[var(--signal-silver-light)]/20">
              <button
                type="button"
                onClick={() => setRefineTab('auto')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  refineTab === 'auto'
                    ? 'bg-[var(--signal-white-pure)] text-[var(--signal-ink)] shadow-sm'
                    : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]'
                }`}
              >
                Auto enhance
              </button>
              <button
                type="button"
                onClick={() => setRefineTab('custom')}
                className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                  refineTab === 'custom'
                    ? 'bg-[var(--signal-white-pure)] text-[var(--signal-ink)] shadow-sm'
                    : 'text-[var(--signal-ink-muted)] hover:text-[var(--signal-ink)]'
                }`}
              >
                Chat instructions
              </button>
            </div>
            {refineTab === 'auto' ? (
              <button
                type="button"
                onClick={() => void handleEnhanceLatest(undefined)}
                disabled={uploading || enhancing}
                className="mt-4 w-full sm:w-auto min-w-[12rem] py-3 px-4 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium tracking-wide disabled:opacity-50 hover:opacity-90"
              >
                {enhancing ? 'Working…' : 'Run auto enhance'}
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
                  Tell the model what to change
                </label>
                <textarea
                  value={customInstruction}
                  onChange={(e) => setCustomInstruction(e.target.value)}
                  placeholder="e.g. Warmer skin tones, softer background, a bit more rim light, keep my expression…"
                  rows={4}
                  disabled={uploading || enhancing}
                  className="w-full rounded-xl border border-[var(--signal-silver-light)] bg-[var(--signal-white-pure)] px-3 py-2.5 text-sm text-[var(--signal-ink)] placeholder:text-[var(--signal-ink-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--signal-gold)]/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => void handleEnhanceLatest(customInstruction)}
                  disabled={uploading || enhancing || !customInstruction.trim()}
                  className="w-full sm:w-auto min-w-[12rem] py-3 px-4 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium tracking-wide disabled:opacity-50 hover:opacity-90"
                >
                  {enhancing ? 'Working…' : 'Apply with instructions'}
                </button>
              </div>
            )}
          </div>
        </details>
        {message && (
          <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}>
            {message.text}
          </p>
        )}
        {message?.type === 'success' && (
          <Link
            to="/dashboard"
            className="mt-4 inline-block w-full text-center py-3 rounded-xl bg-[var(--signal-gold)] text-white text-sm font-medium hover:opacity-90"
          >
            Go to dashboard
          </Link>
        )}

      </div>
    </div>
  )
}

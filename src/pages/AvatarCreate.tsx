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
          // Plain `vite` has no `/api/*`; deploy or run `vercel dev` for serverless routes.
          savedImageUrl = imageUrl
          serverAvatarSynced = false
        } else {
          setMessage({ type: 'error', text: `Avatar save failed: ${apiJson.error ?? `HTTP ${apiRes.status}`}` })
          return
        }
      } catch {
        if (import.meta.env.DEV) {
          savedImageUrl = imageUrl
          serverAvatarSynced = false
        } else {
          setMessage({ type: 'error', text: 'Cannot reach API. Check your connection or try again.' })
          return
        }
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
          : 'Saved. If refine is unavailable locally, run the API server alongside Vite.',
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

  const handleEnhanceLatest = async () => {
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
        apiRes = await fetch(apiUrl('/avatar-generate'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            artist_id: resolvedArtistId,
            image_url: imageUrlForEnhance,
            mode: 'enhance',
            provider: 'gemini',
          }),
        })
      } catch {
        setMessage({
          type: 'error',
          text: 'Can’t reach the API. Vite proxies /api to port 3000 — open a second terminal and run npm run dev:vercel, leave npm run dev on :5173, then try again.',
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
            text: 'API not reachable on port 3000 (Vite proxy failed). Run npm run dev:vercel in another terminal, keep npm run dev on :5173, then try again.',
          })
          return
        }
        const detail =
          apiRes.status === 404
            ? ' The /api route is missing. In a second terminal run: npm run dev:vercel (Vercel serves /api on :3000). Keep npm run dev on :5173 — Vite proxies /api there.'
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
          ? 'Can’t reach the API. Run npm run dev:vercel (port 3000) alongside npm run dev (5173).'
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

        {/* Collapsed by default — expand for Gemini refinement */}
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
              Studio-style pass (Gemini). Needs <code className="text-[10px]">dev:vercel</code> on :3000 and{' '}
              <code className="text-[10px]">GEMINI_API_KEY</code>.
            </p>
            <button
              type="button"
              onClick={handleEnhanceLatest}
              disabled={uploading || enhancing}
              className="mt-4 w-full sm:w-auto min-w-[12rem] py-3 px-4 rounded-xl bg-[var(--signal-ink)] text-white text-sm font-medium tracking-wide disabled:opacity-50 hover:opacity-90"
            >
              {enhancing ? 'Working…' : 'Run refinement'}
            </button>
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

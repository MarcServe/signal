import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { apiUrl, getSession } from '../lib/api'

const AI_FEATURES_ENABLED = import.meta.env.VITE_ENABLE_AI_FEATURES !== 'false'

export function AvatarCreate() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [latestUploadUrl, setLatestUploadUrl] = useState<string | null>(null)
  const [artistId, setArtistId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const [showAiImage, setShowAiImage] = useState(false)
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

      await refreshProfile()
      setMessage({
        type: 'success',
        text: serverAvatarSynced
          ? 'Avatar uploaded. You can enhance it below or go to your dashboard when you’re ready.'
          : 'Avatar uploaded. (Local dev: run `vercel dev` to hit `/api/avatar-generate` and sync the `avatars` table.)',
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
      const apiRes = await fetch(apiUrl('/avatar-generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          artist_id: resolvedArtistId,
          image_url: imageUrlForEnhance,
          mode: 'enhance',
          provider: 'gemini',
        }),
      })
      const apiJson = await apiRes.json().catch(() => ({} as { error?: string; image_url?: string }))
      if (!apiRes.ok) {
        const detail =
          apiRes.status === 404
            ? ' The /api route is missing. In a second terminal run: npm run dev:vercel (Vercel serves /api on :3000). Keep npm run dev on :5173 — Vite proxies /api there.'
            : ''
        setMessage({
          type: 'error',
          text: `Enhance failed: ${apiJson.error ?? `HTTP ${apiRes.status}`}.${detail}`,
        })
        return
      }
      const finalImageUrl = (apiJson.image_url as string | undefined) ?? imageUrlForEnhance
      setLatestUploadUrl(finalImageUrl)
      await supabase.from('users').update({ avatar_url: finalImageUrl, avatar_setup_done: true }).eq('id', user.id)
      await refreshProfile()
      setMessage({ type: 'success', text: 'Enhancement completed and saved.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Enhance request failed.'
      setMessage({ type: 'error', text: msg })
    } finally {
      setEnhancing(false)
    }
  }

  const previewSrc = pickerPreview ?? latestUploadUrl ?? profile.avatar_url ?? null

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Create AI avatar
        </h1>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-6">
          Upload an image. Your avatar will thank supporters and promote products during streams. (MVP: image stored; full AI generation uses OpenAI + ElevenLabs.)
        </p>
        {previewSrc && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <p className="text-xs font-medium text-[var(--signal-ink-muted)] uppercase tracking-wide">
              {pickerPreview ? 'Preview' : 'Your avatar'}
            </p>
            <div className="relative h-44 w-44 overflow-hidden rounded-2xl border border-[var(--signal-silver-light)] bg-[var(--signal-silver-light)]/15 shadow-sm ring-1 ring-black/5">
              <img
                src={previewSrc}
                alt={pickerPreview ? 'Selected image preview' : 'Your avatar'}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        )}
        <label className="block w-full py-8 border-2 border-dashed border-[var(--signal-silver-light)] rounded-xl text-center text-[var(--signal-ink-muted)] cursor-pointer hover:border-[var(--signal-gold)] hover:text-[var(--signal-gold)]">
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
          {uploading ? 'Uploading…' : 'Choose image'}
        </label>
        {AI_FEATURES_ENABLED && (
          <p className="mt-2 text-xs text-[var(--signal-ink-muted)]">
            <button
              type="button"
              onClick={() => setShowAiImage(true)}
              className="text-[var(--signal-gold)] hover:opacity-80 underline"
            >
              AI: Enhance or generate image
            </button>
          </p>
        )}
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

      {AI_FEATURES_ENABLED && showAiImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAiImage(false)}>
          <div className="bg-[var(--signal-white-pure)] rounded-2xl p-6 w-full max-w-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              AI image
            </h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4">
              Enhance an existing photo or generate an avatar from a description. Connect OpenAI or an image API to enable. (Hidden until needed.)
            </p>
            <ul className="text-sm text-[var(--signal-ink-muted)] list-disc list-inside space-y-1 mb-4">
              <li>Enhance image — improve quality of your upload</li>
              <li>Generate from description — create an avatar from text</li>
            </ul>
            <button
              type="button"
              onClick={handleEnhanceLatest}
              disabled={uploading || enhancing}
              className="w-full mb-2 py-2 rounded-xl bg-[var(--signal-gold)] text-white text-sm font-medium disabled:opacity-50"
            >
              {enhancing ? 'Enhancing…' : 'Enhance current avatar'}
            </button>
            <button
              type="button"
              onClick={() => setShowAiImage(false)}
              className="w-full py-2 rounded-xl border border-[var(--signal-silver-light)] text-sm text-[var(--signal-ink-muted)]"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

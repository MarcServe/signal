import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export function Onboarding() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const setDoneAndRedirect = async () => {
    if (!user?.id) return
    const { error: doneError } = await supabase.from('users').update({ avatar_setup_done: true }).eq('id', user.id)
    if (doneError) {
      throw new Error(`Could not mark onboarding complete: ${doneError.message}`)
    }
    const { data: artistRow, error: artistSelectError } = await supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle()
    if (artistSelectError) {
      throw new Error(`Could not check artist profile: ${artistSelectError.message}`)
    }
    let artistId = artistRow?.id ?? null
    if (!artistRow?.id) {
      const { data: insertedArtist, error: artistInsertError } = await supabase.from('artists').insert({
        user_id: user.id,
        display_name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'Artist',
        handle: null,
        avatar_url: profile?.avatar_url ?? null,
      }).select('id').maybeSingle()
      if (artistInsertError && artistInsertError.code !== '23505') {
        throw new Error(`Could not create artist profile: ${artistInsertError.message}`)
      }
      artistId = insertedArtist?.id ?? artistId
    }
    const refreshedProfile = await refreshProfile()
    const goToDashboard = (refreshedProfile?.role ?? profile?.role) !== 'fan' || !!artistId
    navigate(goToDashboard ? '/dashboard' : '/', { replace: true })
  }

  const handleSkip = async () => {
    if (skipping || !user?.id) return
    setMessage(null)
    setSkipping(true)
    try {
      await setDoneAndRedirect()
    } catch {
      setMessage({ type: 'error', text: 'Could not continue. Try again.' })
    } finally {
      setSkipping(false)
    }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    setMessage(null)
    try {
      const { data: artistRow } = await supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle()
      const isArtist = profile?.role === 'artist' || !!artistRow?.id
      if (isArtist) {
        let artistId: string | null = artistRow?.id ?? null
        if (!artistId) {
          const insertRes = await supabase.from('artists').insert({
            user_id: user.id,
            display_name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || 'Artist',
            handle: null,
            avatar_url: profile?.avatar_url ?? null,
          }).select('id').single()
          if (insertRes.data?.id) artistId = insertRes.data.id
          else if (insertRes.error?.code === '23505') {
            const retry = await supabase.from('artists').select('id').eq('user_id', user.id).maybeSingle()
            artistId = retry.data?.id ?? null
          }
        }
        if (!artistId) {
          setMessage({ type: 'error', text: 'Could not create artist profile. Try completing "Become an artist" first.' })
          setUploading(false)
          return
        }
        const path = `avatars/${artistId}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'jpg'}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        if (uploadError) {
          await setDoneAndRedirect()
          setUploading(false)
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        const { error: avatarErr } = await supabase.from('avatars').insert({
          artist_id: artistId,
          image_url: urlData.publicUrl,
          style: 'default',
        })
        if (avatarErr) {
          setMessage({ type: 'error', text: 'Image saved but could not link to profile. Continuing…' })
        }
        await setDoneAndRedirect()
      } else {
        const path = `profiles/${user.id}/${crypto.randomUUID()}.${file.name.split('.').pop() ?? 'jpg'}`
        const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
        if (uploadError) {
          await setDoneAndRedirect()
          setUploading(false)
          return
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
        const { error: userAvatarUpdateError } = await supabase.from('users').update({ avatar_url: urlData.publicUrl }).eq('id', user.id)
        if (userAvatarUpdateError) {
          setMessage({ type: 'error', text: `Image uploaded but profile update failed: ${userAvatarUpdateError.message}` })
        }
        await setDoneAndRedirect()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong.'
      setMessage({ type: 'error', text: msg })
    }
    setUploading(false)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)]">
        <p className="text-[var(--signal-ink-muted)]" style={{ fontFamily: 'var(--font-body)' }}>Loading…</p>
      </div>
    )
  }
  if (!user) {
    navigate('/login', { replace: true })
    return null
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--signal-white)] px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
          Create your avatar
        </h1>
        <p className="text-sm text-[var(--signal-ink-muted)] mb-6">
          Upload a photo for your avatar, or skip for now. You can add one later.
        </p>
        <div className="space-y-3">
          <label className="block w-full py-8 border-2 border-dashed border-[var(--signal-silver-light)] rounded-xl text-center text-[var(--signal-ink-muted)] cursor-pointer hover:border-[var(--signal-gold)] hover:text-[var(--signal-gold)]">
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
            {uploading ? 'Uploading…' : 'Choose image'}
          </label>
          <button
            type="button"
            onClick={handleSkip}
            disabled={uploading || skipping}
            className="w-full py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink-muted)] hover:bg-[var(--signal-silver-light)]/30 hover:text-[var(--signal-ink)] disabled:opacity-50"
          >
            {skipping ? 'Taking you there…' : 'Skip for now'}
          </button>
        </div>
        {message && (
          <p className={`mt-4 text-sm ${message.type === 'error' ? 'text-red-600' : 'text-[var(--signal-gold)]'}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { createMockTip } from '../lib/commerce'
import { getDemoStream, DEMO_STREAM_IDS } from '../data/demoStreams'
import { useSwipeGesture } from '../design-system/gestures'
import { CheckoutDrawer } from '../components/CheckoutDrawer'
import type { CheckoutType } from '../components/CheckoutDrawer'
import { formatGbp, formatGbpWhole } from '../lib/currency'
import { AI_FEATURES_ENABLED } from '../lib/features'
import { resolveStreamPlaybackUrl } from '../lib/hlsPlayback'
import { getYoutubeVideoIdFromPlayback } from '../lib/youtubePlayback'
import { HlsVideo } from '../components/HlsVideo'

const FREE_VIEW_MINUTES = 20

type StreamChatRow = { id: string; display_name: string | null; body: string; created_at: string }

type LiveShopProduct = { id: string; title: string; price_cents: number | null; type: string }

type LivePurchase = {
  title: string
  type: CheckoutType
  itemId?: string
  amountCents: number
  membershipId?: string
}

type CommerceBrowse = null | 'tracks' | 'tickets' | 'memberships'

function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>
  )
}
function IconSpark({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" d="M12 3v2m0 14v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M3 12h2m14 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}
function IconHands({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v4a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 013 0m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
    </svg>
  )
}

export function LiveView() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [stream, setStream] = useState<{
    id: string
    title: string | null
    playback_url: string | null
    stream_key: string | null
    artist_id: string
    is_live: boolean
  } | null>(null)
  const [artist, setArtist] = useState<{ display_name: string; avatar_url: string | null } | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [watchStart, setWatchStart] = useState<number | null>(null)
  const [showPurchaseDrawer, setShowPurchaseDrawer] = useState(false)
  const [purchaseProduct, setPurchaseProduct] = useState<LivePurchase | null>(null)
  const [liveTracks, setLiveTracks] = useState<LiveShopProduct[]>([])
  const [liveTickets, setLiveTickets] = useState<LiveShopProduct[]>([])
  const [commerceBrowse, setCommerceBrowse] = useState<CommerceBrowse>(null)
  const [showTipDrawer, setShowTipDrawer] = useState(false)
  const [tipAmountCents, setTipAmountCents] = useState(500)
  const [tipSending, setTipSending] = useState(false)
  const [shareToast, setShareToast] = useState(false)
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [hostPersona, setHostPersona] = useState<'dj' | 'avatar'>(AI_FEATURES_ENABLED ? 'avatar' : 'dj')
  const [showPollsCard, setShowPollsCard] = useState(false)
  const [reactionCounts, setReactionCounts] = useState({ heart: 0, fire: 0, hands: 0 })
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [showOverlaySheet, setShowOverlaySheet] = useState(false)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [memberships, setMemberships] = useState<{ id: string; title: string; price_cents: number }[]>([])
  const [chatMessages, setChatMessages] = useState<StreamChatRow[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)

  useEffect(() => {
    if (!streamId) return
    const demo = getDemoStream(streamId)
    if (demo) {
      setStream({
        id: demo.id,
        title: demo.title,
        playback_url: demo.playback_url,
        stream_key: null,
        artist_id: demo.artist_id,
        is_live: demo.is_live,
      })
      setArtist({ display_name: demo.display_name, avatar_url: demo.avatar_url })
      setAvatarUrl(demo.avatar_image_url)
      return
    }
    supabase
      .from('streams')
      .select('id, title, playback_url, stream_key, artist_id, is_live')
      .eq('id', streamId)
      .single()
      .then(({ data }) => {
        setStream(data ?? null)
        if (data?.artist_id) {
          supabase
            .from('artists')
            .select('display_name, avatar_url')
            .eq('id', data.artist_id)
            .single()
            .then(({ data: a }) => setArtist(a ?? null))
          supabase
            .from('avatars')
            .select('image_url')
            .eq('artist_id', data.artist_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()
            .then(({ data: av }) => setAvatarUrl(av?.image_url ?? null))
        }
      })
  }, [streamId])

  /** Keep “Live” badge in sync when the artist toggles `is_live` from Dashboard. */
  useEffect(() => {
    if (!streamId || streamId.startsWith('demo-')) return
    const iv = setInterval(() => {
      void supabase
        .from('streams')
        .select('is_live')
        .eq('id', streamId)
        .single()
        .then(({ data }) => {
          if (data)
            setStream((prev) => (prev ? { ...prev, is_live: data.is_live } : prev))
        })
    }, 10000)
    return () => clearInterval(iv)
  }, [streamId])

  /** Live chat: load history + Supabase Realtime (requires migration 00009_stream_chat + Realtime enabled). */
  useEffect(() => {
    if (!streamId || streamId.startsWith('demo-')) {
      setChatMessages([])
      return
    }
    let cancelled = false
    setChatError(null)

    void supabase
      .from('stream_chat_messages')
      .select('id, display_name, body, created_at')
      .eq('stream_id', streamId)
      .order('created_at', { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          if (/relation|does not exist|404/i.test(error.message)) {
            setChatError('Chat will work after the stream_chat migration is applied to your Supabase project.')
          } else {
            setChatError(error.message)
          }
          return
        }
        setChatMessages((data ?? []) as StreamChatRow[])
      })

    const channel = supabase
      .channel(`stream-chat:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'stream_chat_messages',
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const row = payload.new as StreamChatRow
          if (row?.id && row?.body) {
            setChatMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]))
          }
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' && !cancelled) {
          setChatError((prev) => prev || 'Realtime error — enable Realtime for table stream_chat_messages in Supabase.')
        }
      })

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  }, [streamId])

  useEffect(() => {
    if (!stream) return
    setWatchStart(Date.now())
  }, [stream?.id])

  useEffect(() => {
    if (!user?.id || !stream?.artist_id || stream.artist_id.startsWith('demo-')) return
    supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('artist_id', stream.artist_id)
      .eq('status', 'active')
      .maybeSingle()
      .then(({ data }) => setIsSubscribed(!!data))
  }, [user?.id, stream?.artist_id])

  useEffect(() => {
    if (!stream?.artist_id || stream.artist_id.startsWith('demo-')) return
    supabase.from('memberships').select('id, title, price_cents').eq('artist_id', stream.artist_id).then(({ data }) => setMemberships((data ?? []) as typeof memberships))
  }, [stream?.artist_id])

  useEffect(() => {
    if (!stream?.artist_id || stream.artist_id.startsWith('demo-')) {
      setLiveTracks([])
      setLiveTickets([])
      return
    }
    void supabase
      .from('products')
      .select('id, title, price_cents, type')
      .eq('artist_id', stream.artist_id)
      .in('type', ['track', 'ticket'])
      .then(({ data }) => {
        const rows = (data ?? []) as LiveShopProduct[]
        setLiveTracks(rows.filter((r) => r.type === 'track'))
        setLiveTickets(rows.filter((r) => r.type === 'ticket'))
      })
  }, [stream?.artist_id])

  useEffect(() => {
    if (watchStart == null || isSubscribed) return
    const t = setInterval(() => {
      const elapsed = (Date.now() - watchStart) / 60000
      if (elapsed >= FREE_VIEW_MINUTES) setShowPaywall(true)
    }, 10000)
    return () => clearInterval(t)
  }, [watchStart, isSubscribed])

  const goPrev = useCallback(() => {
    setShowPaywall(false)
    if (!streamId) return
    const demo = getDemoStream(streamId)
    if (demo && DEMO_STREAM_IDS.length > 0) {
      const idx = DEMO_STREAM_IDS.indexOf(streamId)
      const prevId = idx <= 0 ? DEMO_STREAM_IDS[DEMO_STREAM_IDS.length - 1] : DEMO_STREAM_IDS[idx - 1]
      navigate(`/live/${prevId}`, { replace: true })
    }
  }, [streamId, navigate])
  const goNext = useCallback(() => {
    setShowPaywall(false)
    if (!streamId) return
    const demo = getDemoStream(streamId)
    if (demo && DEMO_STREAM_IDS.length > 0) {
      const idx = DEMO_STREAM_IDS.indexOf(streamId)
      const nextId = idx < 0 || idx >= DEMO_STREAM_IDS.length - 1 ? DEMO_STREAM_IDS[0] : DEMO_STREAM_IDS[idx + 1]
      navigate(`/live/${nextId}`, { replace: true })
    }
  }, [streamId, navigate])

  const { onTouchStart, onTouchEnd } = useSwipeGesture({
    onSwipeDown: () => navigate('/', { replace: true }),
    onSwipeUp: () => stream && navigate(`/artist/${stream.artist_id}`),
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
  })

  if (!stream) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--signal-ink)] text-white">
        Loading…
      </div>
    )
  }

  const youtubeVideoId = getYoutubeVideoIdFromPlayback(stream.playback_url)
  const playbackSrc = youtubeVideoId ? null : resolveStreamPlaybackUrl(stream)

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Full-bleed video */}
      <div className="absolute inset-0 flex items-center justify-center bg-[var(--signal-ink)]">
        {youtubeVideoId ? (
          <iframe
            title={stream.title ? `Stream: ${stream.title}` : 'Stream'}
            className="max-h-full w-full aspect-video border-0"
            src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : playbackSrc ? (
          <HlsVideo
            className="max-h-full w-full object-contain"
            src={playbackSrc}
            autoPlay
            playsInline
            muted
            controls
          />
        ) : (
          <div className="text-white/60 text-center p-4">
            <p className="text-lg">No stream URL configured.</p>
            <p className="text-sm mt-2">Use RTMP/OBX to go live.</p>
          </div>
        )}
      </div>

      {/* Overlay: top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2">
          {artist?.avatar_url && (
            <img src={artist.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          )}
          <span className="text-white font-medium">{artist?.display_name ?? 'Artist'}</span>
          {stream.is_live && (
            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-xs uppercase">Live</span>
          )}
        </div>
      </div>

      {/* Reactions — original compact size; colour-coded for visibility on video */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4 pointer-events-auto">
        <button
          type="button"
          onClick={() => setReactionCounts((c) => ({ ...c, heart: c.heart + 1 }))}
          className="flex flex-col items-center gap-0.5 text-rose-500 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.85))] hover:text-rose-400"
          aria-label="Love — tap to send a like"
          title="Love — tap to send a like"
        >
          <IconHeart className="h-6 w-6" />
          {reactionCounts.heart > 0 && (
            <span className="text-[10px] tabular-nums tracking-widest text-rose-100 [text-shadow:0_0_8px_rgba(0,0,0,0.9)]">
              {reactionCounts.heart}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setReactionCounts((c) => ({ ...c, fire: c.fire + 1 }))}
          className="flex flex-col items-center gap-0.5 text-amber-400 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.85))] hover:text-amber-300"
          aria-label="Highlight — celebrate a stand-out moment"
          title="Highlight — celebrate a stand-out moment"
        >
          <IconSpark className="h-6 w-6" />
          {reactionCounts.fire > 0 && (
            <span className="text-[10px] tabular-nums tracking-widest text-amber-100 [text-shadow:0_0_8px_rgba(0,0,0,0.9)]">
              {reactionCounts.fire}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setReactionCounts((c) => ({ ...c, hands: c.hands + 1 }))}
          className="flex flex-col items-center gap-0.5 text-[var(--signal-gold)] [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.85))] hover:text-[#e8d5a3]"
          aria-label="Applause — clap for the artist"
          title="Applause — clap for the artist"
        >
          <IconHands className="h-6 w-6" />
          {reactionCounts.hands > 0 && (
            <span className="text-[10px] tabular-nums tracking-widest text-[#fdf6e3] [text-shadow:0_0_8px_rgba(0,0,0,0.9)]">
              {reactionCounts.hands}
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => setShowChat((s) => !s)}
        className="absolute right-3 bottom-24 z-20 rounded-full border border-white/25 bg-black/40 px-4 py-2 text-xs font-medium tracking-[0.2em] uppercase text-white/90 hover:bg-black/55 pointer-events-auto"
        aria-label="Chat"
      >
        Chat
      </button>
      {showChat && (
        <div className="absolute right-3 bottom-36 z-30 w-[min(100vw-1.5rem,20rem)] max-h-[min(50vh,18rem)] rounded-xl bg-black/85 text-white text-sm overflow-hidden flex flex-col pointer-events-auto border border-white/15 shadow-xl">
          <div className="p-2 border-b border-white/20 flex items-center justify-between shrink-0">
            <span className="font-medium">Live chat</span>
            <button
              type="button"
              onClick={() => setShowPollsCard(true)}
              className="text-white/80 hover:text-white text-xs"
            >
              Polls
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
            {streamId?.startsWith('demo-') ? (
              <p className="text-xs text-white/70">Demo stream — chat is disabled.</p>
            ) : chatError ? (
              <p className="text-xs text-amber-200/90">{chatError}</p>
            ) : chatMessages.length === 0 ? (
              <p className="text-xs text-white/60">No messages yet. Say hi!</p>
            ) : (
              chatMessages.map((m) => (
                <div key={m.id} className="text-xs leading-snug">
                  <span className="font-semibold text-[var(--signal-gold)]">
                    {m.display_name?.trim() || 'Fan'}
                  </span>
                  <span className="text-white/50"> · </span>
                  <span className="text-white/90">{m.body}</span>
                </div>
              ))
            )}
          </div>
          {streamId && !streamId.startsWith('demo-') && (
            <div className="p-2 border-t border-white/20 shrink-0">
              {user ? (
                <form
                  className="flex gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const text = chatInput.trim().slice(0, 500)
                    if (!text || !stream?.id || chatSending || streamId?.startsWith('demo-')) return
                    setChatSending(true)
                    setChatError(null)
                    const displayName =
                      profile?.full_name?.trim() || user.email?.split('@')[0] || 'Fan'
                    void supabase
                      .from('stream_chat_messages')
                      .insert({
                        stream_id: stream.id,
                        user_id: user.id,
                        display_name: displayName,
                        body: text,
                      })
                      .then(({ error }) => {
                        setChatSending(false)
                        if (error) {
                          setChatError(error.message)
                          return
                        }
                        setChatInput('')
                      })
                  }}
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Message…"
                    maxLength={500}
                    disabled={chatSending}
                    className="flex-1 min-w-0 rounded-lg bg-white/10 border border-white/20 px-2 py-1.5 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[var(--signal-gold)]"
                  />
                  <button
                    type="submit"
                    disabled={chatSending || !chatInput.trim()}
                    className="shrink-0 rounded-lg bg-[var(--signal-gold)] text-[var(--signal-ink)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  >
                    Send
                  </button>
                </form>
              ) : (
                <p className="text-[11px] text-white/60 text-center">Sign in to send messages.</p>
              )}
            </div>
          )}
        </div>
      )}
      {showPollsCard && (
        <div className="absolute right-3 bottom-36 z-40 w-72 rounded-xl bg-black/90 text-white text-sm p-4 pointer-events-auto border border-white/20">
          <p className="text-white/90">Polls will appear here when the artist starts one.</p>
          <button type="button" onClick={() => setShowPollsCard(false)} className="mt-2 text-xs text-[var(--signal-gold)] hover:opacity-80">Close</button>
        </div>
      )}

      {/* Minimal overlay: single More button */}
      <div className="absolute bottom-0 left-0 right-0 p-4 flex justify-center bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
        <button
          type="button"
          onClick={() => setShowOverlaySheet(true)}
          className="pointer-events-auto px-5 py-2.5 rounded-full bg-white/20 text-white text-sm font-medium hover:bg-white/30"
          aria-label="More actions"
        >
          More
        </button>
      </div>

      {/* Overlay sheet: Tip, Share, Buy track, Get ticket, Join membership */}
      {showOverlaySheet && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50" onClick={() => setShowOverlaySheet(false)}>
          <div className="bg-[var(--signal-white-pure)] rounded-t-2xl w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-[var(--signal-ink-muted)]">Actions</span>
              <button type="button" onClick={() => setShowOverlaySheet(false)} className="text-[var(--signal-ink-muted)]">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setShowOverlaySheet(false); setShowTipDrawer(true); }} className="py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide">Tip</button>
              <button type="button" onClick={() => { setShowOverlaySheet(false); setShowShareSheet(true); }} className="py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide">Share</button>
              <button
                type="button"
                onClick={() => {
                  setShowOverlaySheet(false)
                  if (liveTracks.length === 0) {
                    setCommerceBrowse('tracks')
                    return
                  }
                  if (liveTracks.length === 1) {
                    const t = liveTracks[0]
                    setPurchaseProduct({
                      title: t.title,
                      type: 'track',
                      itemId: t.id,
                      amountCents: t.price_cents ?? 999,
                    })
                    setShowPurchaseDrawer(true)
                    return
                  }
                  setCommerceBrowse('tracks')
                }}
                className="py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide"
              >
                Track{liveTracks.length > 0 ? ` (${liveTracks.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverlaySheet(false)
                  if (liveTickets.length === 0) {
                    setCommerceBrowse('tickets')
                    return
                  }
                  if (liveTickets.length === 1) {
                    const t = liveTickets[0]
                    setPurchaseProduct({
                      title: t.title,
                      type: 'ticket',
                      itemId: t.id,
                      amountCents: t.price_cents ?? 999,
                    })
                    setShowPurchaseDrawer(true)
                    return
                  }
                  setCommerceBrowse('tickets')
                }}
                className="py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide"
              >
                Ticket{liveTickets.length > 0 ? ` (${liveTickets.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowOverlaySheet(false)
                  if (memberships.length === 0) {
                    setAvatarMessage('No membership tiers are available yet.')
                    setTimeout(() => setAvatarMessage(null), 4000)
                    return
                  }
                  if (memberships.length === 1) {
                    const m = memberships[0]
                    setPurchaseProduct({
                      title: m.title,
                      type: 'membership',
                      membershipId: m.id,
                      amountCents: m.price_cents ?? 999,
                    })
                    setShowPurchaseDrawer(true)
                    return
                  }
                  setCommerceBrowse('memberships')
                }}
                className="col-span-2 py-3 rounded-xl border border-[var(--signal-ink)] bg-[var(--signal-ink)] text-white text-sm font-medium tracking-wide"
              >
                Membership{memberships.length > 1 ? ` (${memberships.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pick a track / ticket / tier (from Studio catalog) */}
      {commerceBrowse && stream && (
        <div
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setCommerceBrowse(null)}
        >
          <div
            className="bg-[var(--signal-white-pure)] rounded-t-2xl w-full max-w-md max-h-[min(70vh,520px)] overflow-y-auto p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-[var(--signal-ink)]">
                {commerceBrowse === 'tracks' ? 'Tracks' : commerceBrowse === 'tickets' ? 'Tickets' : 'Membership'}
              </span>
              <button type="button" onClick={() => setCommerceBrowse(null)} className="text-[var(--signal-ink-muted)]">
                ✕
              </button>
            </div>
            {commerceBrowse === 'tracks' &&
              (liveTracks.length === 0 ? (
                <p className="text-sm text-[var(--signal-ink-muted)] py-2">
                  No tracks in the shop yet. Add products in Studio → Products and set type to <strong className="text-[var(--signal-ink)]">Track</strong>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {liveTracks.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="w-full text-left py-3 px-3 rounded-xl border border-[var(--signal-silver-light)] hover:bg-[var(--signal-silver-light)]/20 flex justify-between gap-2 items-center"
                        onClick={() => {
                          setPurchaseProduct({
                            title: t.title,
                            type: 'track',
                            itemId: t.id,
                            amountCents: t.price_cents ?? 999,
                          })
                          setShowPurchaseDrawer(true)
                          setCommerceBrowse(null)
                        }}
                      >
                        <span className="text-sm font-medium text-[var(--signal-ink)] truncate">{t.title}</span>
                        <span className="text-sm text-[var(--signal-gold)] shrink-0">
                          {formatGbp(t.price_cents ?? 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            {commerceBrowse === 'tickets' &&
              (liveTickets.length === 0 ? (
                <p className="text-sm text-[var(--signal-ink-muted)] py-2">
                  No tickets listed yet. Add products in Studio → Products and set type to <strong className="text-[var(--signal-ink)]">Ticket</strong>.
                </p>
              ) : (
                <ul className="space-y-2">
                  {liveTickets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        className="w-full text-left py-3 px-3 rounded-xl border border-[var(--signal-silver-light)] hover:bg-[var(--signal-silver-light)]/20 flex justify-between gap-2 items-center"
                        onClick={() => {
                          setPurchaseProduct({
                            title: t.title,
                            type: 'ticket',
                            itemId: t.id,
                            amountCents: t.price_cents ?? 999,
                          })
                          setShowPurchaseDrawer(true)
                          setCommerceBrowse(null)
                        }}
                      >
                        <span className="text-sm font-medium text-[var(--signal-ink)] truncate">{t.title}</span>
                        <span className="text-sm text-[var(--signal-gold)] shrink-0">
                          {formatGbp(t.price_cents ?? 0)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
            {commerceBrowse === 'memberships' &&
              (memberships.length === 0 ? (
                <p className="text-sm text-[var(--signal-ink-muted)] py-2">No tiers available.</p>
              ) : (
                <ul className="space-y-2">
                  {memberships.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className="w-full text-left py-3 px-3 rounded-xl border border-[var(--signal-silver-light)] hover:bg-[var(--signal-silver-light)]/20 flex justify-between gap-2 items-center"
                        onClick={() => {
                          setPurchaseProduct({
                            title: m.title,
                            type: 'membership',
                            membershipId: m.id,
                            amountCents: m.price_cents ?? 999,
                          })
                          setShowPurchaseDrawer(true)
                          setCommerceBrowse(null)
                        }}
                      >
                        <span className="text-sm font-medium text-[var(--signal-ink)] truncate">{m.title}</span>
                        <span className="text-sm text-[var(--signal-gold)] shrink-0">
                          {formatGbp(m.price_cents ?? 0)}/mo
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ))}
          </div>
        </div>
      )}

      {/* Share sheet: Copy link, Instagram, TikTok */}
      {showShareSheet && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50" onClick={() => setShowShareSheet(false)}>
          <div className="bg-[var(--signal-white-pure)] rounded-t-2xl w-full max-w-md p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-medium text-[var(--signal-ink)]">Share</span>
              <button type="button" onClick={() => setShowShareSheet(false)} className="text-[var(--signal-ink-muted)]">✕</button>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(window.location.href); setShareToast(true); setTimeout(() => setShareToast(false), 2000); setShowShareSheet(false); }} className="w-full py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm">Copy link</button>
              <button type="button" onClick={async () => { const text = `${stream?.title ?? 'Live'} — ${window.location.href}`; await navigator.clipboard.writeText(text); setShareToast(true); setTimeout(() => setShareToast(false), 2000); setShowShareSheet(false); }} className="w-full py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide">Copy caption + link</button>
              <button type="button" onClick={async () => { const text = `${window.location.href}`; await navigator.clipboard.writeText(text); setShareToast(true); setTimeout(() => setShareToast(false), 2000); setShowShareSheet(false); }} className="w-full py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] text-sm tracking-wide">Copy link only</button>
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/70 text-white text-sm pointer-events-none">
          Link copied
        </div>
      )}

      {AI_FEATURES_ENABLED && (
        <div className="absolute left-3 bottom-24 z-20 flex items-center gap-2 pointer-events-auto">
          <span className="text-white/50 text-[10px] uppercase tracking-[0.2em]">Host</span>
          <button
            type="button"
            onClick={() => setHostPersona((p) => (p === 'dj' ? 'avatar' : 'dj'))}
            className="px-2 py-1 rounded border border-white/20 bg-black/40 text-white text-[10px] uppercase tracking-widest hover:bg-black/60"
          >
            {hostPersona === 'dj' ? 'Live' : 'Portrait'}
          </button>
        </div>
      )}

      {avatarMessage && (
        <div className="absolute bottom-24 left-4 right-4 flex justify-center pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-sm bg-black/75 text-white text-sm max-w-sm tracking-wide border border-white/10">
            {AI_FEATURES_ENABLED && hostPersona === 'avatar' && avatarUrl && (
              <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0 ring-1 ring-white/20" />
            )}
            <span className="text-white/95">{avatarMessage}</span>
          </div>
        </div>
      )}

      {/* 20-min free watch → subscription or pay-per-view */}
      {showPaywall && stream && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[var(--signal-white-pure)] rounded-2xl p-6 max-w-sm w-full text-center">
            <h2 className="text-xl font-semibold text-[var(--signal-ink)] mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              Keep watching
            </h2>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-6">
              You’ve reached the 20-minute free limit. Subscribe or pay once to continue.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowPaywall(false)
                if (memberships.length === 0) {
                  setAvatarMessage('No membership tiers are available yet.')
                  setTimeout(() => setAvatarMessage(null), 4000)
                  return
                }
                if (memberships.length === 1) {
                  const m = memberships[0]
                  setPurchaseProduct({
                    title: m.title,
                    type: 'membership',
                    membershipId: m.id,
                    amountCents: m.price_cents ?? 999,
                  })
                  setShowPurchaseDrawer(true)
                  return
                }
                setCommerceBrowse('memberships')
              }}
              className="w-full py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium mb-2"
            >
              Subscribe — monthly access
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPaywall(false)
                setPurchaseProduct({ title: 'Pay per view', type: 'ppv', amountCents: 499 })
                setShowPurchaseDrawer(true)
              }}
              className="w-full py-3 rounded-xl border border-[var(--signal-silver-light)] text-[var(--signal-ink)] font-medium mb-2"
            >
              Pay per view — watch this stream
            </button>
            <button
              type="button"
              onClick={() => navigate('/', { replace: true })}
              className="w-full py-2 text-sm text-[var(--signal-ink-muted)]"
            >
              Back to feed
            </button>
          </div>
        </div>
      )}

      {/* Tip drawer */}
      {showTipDrawer && stream && (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/50" onClick={() => { setShowTipDrawer(false); }}>
          <div
            className="bg-[var(--signal-white-pure)] rounded-t-2xl w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-[var(--signal-ink)] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Tip {artist?.display_name ?? 'artist'}
            </h3>
            <p className="text-sm text-[var(--signal-ink-muted)] mb-4">
              Choose an amount (mock payment).
            </p>
            <div className="flex gap-2 mb-4">
              {[100, 500, 1000, 2500, 5000].map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => setTipAmountCents(cents)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium ${tipAmountCents === cents ? 'bg-[var(--signal-gold)] text-white' : 'bg-[var(--signal-silver-light)]/50 text-[var(--signal-ink)]'}`}
                >
                  {formatGbpWhole(cents)}
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!user || tipSending}
              onClick={async () => {
                if (!user || !stream) return
                setTipSending(true)
                setShowTipDrawer(false)
                const isDemoStream = stream.artist_id.startsWith('demo-')
                if (isDemoStream) {
                  setTipSending(false)
                  setAvatarMessage('Thank you for the tip!')
                  setTimeout(() => setAvatarMessage(null), 4000)
                  return
                }
                const res = await createMockTip(user.id, stream.artist_id, tipAmountCents)
                setTipSending(false)
                if (res.success) {
                  setAvatarMessage('Thank you for the tip!')
                  setTimeout(() => setAvatarMessage(null), 4000)
                }
              }}
              className="w-full py-3 rounded-xl bg-[var(--signal-gold)] text-white font-medium disabled:opacity-50"
            >
              {tipSending ? 'Sending…' : `Tip ${formatGbp(tipAmountCents)}`}
            </button>
            <button
              type="button"
              onClick={() => setShowTipDrawer(false)}
              className="w-full py-2 mt-2 text-sm text-[var(--signal-ink-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* In-stream purchase: CheckoutDrawer (live or mock) */}
      {stream && (
        <CheckoutDrawer
          open={showPurchaseDrawer}
          onClose={() => { setShowPurchaseDrawer(false); setPurchaseProduct(null); }}
          title={purchaseProduct?.title ?? 'Complete purchase'}
          type={(purchaseProduct?.type as CheckoutType) ?? 'track'}
          artistId={stream.artist_id}
          itemId={purchaseProduct?.itemId}
          membershipId={purchaseProduct?.membershipId}
          amountCents={purchaseProduct?.amountCents ?? 999}
          onSuccess={() => {
            setAvatarMessage('Thanks for your purchase!')
            setTimeout(() => setAvatarMessage(null), 4000)
          }}
        />
      )}
    </div>
  )
}

import { useEffect, useRef, type VideoHTMLAttributes } from 'react'
import Hls from 'hls.js'

type HlsVideoProps = {
  src: string
  className?: string
  /** Called when HLS fails fatally (e.g. manifest 404, network error). */
  onFatalMediaError?: (message: string) => void
} & Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'>

/**
 * Plays HLS (.m3u8) in Chrome/Firefox via hls.js; Safari uses native playback.
 */
export function HlsVideo({ src, className, onFatalMediaError, ...videoProps }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onFatalRef = useRef(onFatalMediaError)
  onFatalRef.current = onFatalMediaError

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const isHls = /\.m3u8(\?|$)/i.test(src)

    if (!isHls) {
      video.src = src
      const onErr = () => onFatalRef.current?.('Video failed to load.')
      video.addEventListener('error', onErr)
      return () => {
        video.removeEventListener('error', onErr)
        video.removeAttribute('src')
        video.load()
      }
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })
      const onHlsError = (_: string, data: { fatal?: boolean; type?: string; details?: string }) => {
        if (data.fatal) {
          onFatalRef.current?.(
            data.details === 'manifestLoadError'
              ? 'Live playlist not found (is the stream publishing to RTMP?)'
              : data.details || data.type || 'Playback error',
          )
        }
      }
      hls.on(Hls.Events.ERROR, onHlsError)
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => {
        hls.off(Hls.Events.ERROR, onHlsError)
        hls.destroy()
        video.removeAttribute('src')
        video.load()
      }
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      const onErr = () => onFatalRef.current?.('Video failed to load (native HLS).')
      video.addEventListener('error', onErr)
      return () => {
        video.removeEventListener('error', onErr)
        video.removeAttribute('src')
        video.load()
      }
    }

    video.src = src
    const onErr = () => onFatalRef.current?.('Video failed to load.')
    video.addEventListener('error', onErr)
    return () => {
      video.removeEventListener('error', onErr)
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  return <video ref={videoRef} className={className} {...videoProps} />
}

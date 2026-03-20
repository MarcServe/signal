import { useEffect, useRef, type VideoHTMLAttributes } from 'react'
import Hls from 'hls.js'

type HlsVideoProps = {
  src: string
  className?: string
} & Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'>

/**
 * Plays HLS (.m3u8) in Chrome/Firefox via hls.js; Safari uses native playback.
 */
export function HlsVideo({ src, className, ...videoProps }: HlsVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const isHls = /\.m3u8(\?|$)/i.test(src)

    if (!isHls) {
      video.src = src
      return () => {
        video.removeAttribute('src')
        video.load()
      }
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => {
        hls.destroy()
        video.removeAttribute('src')
        video.load()
      }
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return () => {
        video.removeAttribute('src')
        video.load()
      }
    }

    video.src = src
    return () => {
      video.removeAttribute('src')
      video.load()
    }
  }, [src])

  return <video ref={videoRef} className={className} {...videoProps} />
}

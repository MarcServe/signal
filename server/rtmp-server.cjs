/**
 * Signal RTMP ingest server.
 * Accepts RTMP push (e.g. from OBS), transcodes to HLS for web playback.
 *
 * Prerequisites: FFmpeg installed and on PATH (or set RTMP_FFMPEG_PATH).
 *
 * OBS: Server = rtmp://localhost:1935/live, Stream Key = <your_stream_key>
 * Playback URL (for streams.playback_url): http://localhost:8000/live/<stream_key>/index.m3u8
 *
 * Note: node-media-server v4 does not support built-in HLS transcoding. We spawn FFmpeg
 * on publish to pull RTMP and write HLS to MEDIA_ROOT; port 8000 serves that as static files.
 */

const NodeMediaServer = require('node-media-server')
const path = require('path')
const fs = require('fs')
const http = require('http')
const { spawn } = require('child_process')

const RTMP_PORT = parseInt(process.env.RTMP_PORT || '1935', 10)
const HTTP_PORT = parseInt(process.env.RTMP_HTTP_PORT || '8000', 10)
const NMS_HTTP_PORT = 8002 // FLV / node-media-server HTTP (HLS is on HTTP_PORT)
const MEDIA_ROOT = path.resolve(process.env.RTMP_MEDIA_ROOT || path.join(__dirname, 'media'))
const FFMPEG_PATH = process.env.RTMP_FFMPEG_PATH || 'ffmpeg'

// FFmpeg processes by stream path (e.g. "/live/Whitesheep21")
const ffmpegProcesses = new Map()

// Ensure media root exists
try {
  fs.mkdirSync(MEDIA_ROOT, { recursive: true })
} catch (e) {
  if (e.code !== 'EEXIST') throw e
}

// node-media-server v4 logs "undefined:PORT" if `bind` is missing (listen still works; this fixes logs + host).
const config = {
  bind: '0.0.0.0',
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: NMS_HTTP_PORT,
    allow_origin: '*',
  },
}

const nms = new NodeMediaServer(config)

// HLS static file server on HTTP_PORT (serves MEDIA_ROOT so /live/<key>/index.m3u8 works)
const hlsServer = http.createServer((req, res) => {
  const pathname = (req.url || '/').split('?')[0]
  if (pathname === '/' || pathname === '') {
    res.setHeader('Content-Type', 'text/plain')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.writeHead(200)
    res.end('Signal HLS server. Streams: http://127.0.0.1:' + HTTP_PORT + '/live/<stream_key>/index.m3u8')
    return
  }
  const relative = path.normalize(pathname).replace(/^\//, '')
  const filePath = path.join(MEDIA_ROOT, relative)
  if (!filePath.startsWith(MEDIA_ROOT) || relative.startsWith('..')) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (serr, st) => {
    if (serr) {
      if (serr.code === 'ENOENT') {
        res.setHeader('Content-Type', 'text/plain')
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.writeHead(404)
        res.end(
          'Not Found. Use the full playlist URL:\n' +
            pathname.replace(/\/?$/, '/') +
            'index.m3u8\n\n(Stream must be publishing from OBS with the same stream key.)',
        )
        return
      }
      res.writeHead(500)
      res.end('Error')
      return
    }
    if (st.isDirectory()) {
      const loc = pathname.endsWith('/') ? pathname + 'index.m3u8' : pathname + '/index.m3u8'
      res.writeHead(302, { Location: loc, 'Access-Control-Allow-Origin': '*' })
      res.end()
      return
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        const msg =
          err.code === 'EISDIR'
            ? 'This path is a folder. Open ' + pathname.replace(/\/?$/, '/') + 'index.m3u8'
            : err.code === 'ENOENT'
              ? 'Not Found'
              : 'Error'
        res.writeHead(err.code === 'ENOENT' ? 404 : 500)
        res.end(msg)
        return
      }
      const ext = path.extname(filePath)
      const types = {
        '.m3u8': 'application/vnd.apple.mpegurl',
        '.ts': 'video/MP2T',
      }
      res.setHeader('Content-Type', types[ext] || 'application/octet-stream')
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.writeHead(200)
      res.end(data)
    })
  })
})

function streamPathToKey(streamPath) {
  if (typeof streamPath !== 'string') return null
  const key = streamPath.replace(/^\/?live\//, '').trim()
  return key || null
}

nms.on('preConnect', (session) => {
  console.log('[RTMP] preConnect', session?.id, session?.streamPath)
})

nms.on('postConnect', (session) => {
  console.log('[RTMP] postConnect', session?.id)
})

nms.on('doneConnect', (session) => {
  console.log('[RTMP] doneConnect', session?.id)
})

nms.on('prePublish', (session) => {
  const streamPath = session?.streamPath
  console.log('[RTMP] prePublish', session?.id, streamPath)
  const streamKey = streamPathToKey(streamPath)
  if (streamKey) {
    console.log(
      '[RTMP] Stream key:',
      streamKey,
      '→ HLS: http://127.0.0.1:' + HTTP_PORT + '/live/' + streamKey + '/index.m3u8',
    )
  }
})

nms.on('postPublish', (session) => {
  const streamPath = session?.streamPath
  console.log('[RTMP] postPublish', streamPath)
  const streamKey = streamPathToKey(streamPath)
  if (!streamKey) return

  const outDir = path.join(MEDIA_ROOT, 'live', streamKey)
  const outPlaylist = path.join(outDir, 'index.m3u8')
  try {
    fs.mkdirSync(outDir, { recursive: true })
  } catch (e) {
    console.error('[RTMP] Failed to create HLS dir:', outDir, e.message)
    return
  }

  const rtmpUrl = 'rtmp://127.0.0.1:' + RTMP_PORT + streamPath
  const args = [
    '-i', rtmpUrl,
    '-c', 'copy',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments+append_list',
    '-y',
    outPlaylist,
  ]
  const ff = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'] })
  ffmpegProcesses.set(streamPath, ff)
  ff.on('error', (err) => {
    console.error('[RTMP] FFmpeg spawn error for', streamPath, err.message)
    ffmpegProcesses.delete(streamPath)
  })
  ff.on('exit', (code, signal) => {
    ffmpegProcesses.delete(streamPath)
    console.log('[RTMP] FFmpeg exit for', streamPath, { code, signal })
  })
  ff.stderr?.on('data', (chunk) => {
    const line = String(chunk).trim()
    if (line.startsWith('frame=') || line.includes('error') || line.includes('Error')) {
      process.stderr.write('[FFmpeg ' + streamKey + '] ' + line + '\n')
    }
  })
  console.log('[RTMP] FFmpeg started for', streamKey, '→', outPlaylist)
})

nms.on('donePublish', (session) => {
  const streamPath = session?.streamPath
  console.log('[RTMP] donePublish', streamPath)
  const ff = ffmpegProcesses.get(streamPath)
  if (ff && ff.kill) {
    ff.kill('SIGTERM')
    ffmpegProcesses.delete(streamPath)
  }
})

console.log('Signal RTMP server')
console.log('  RTMP ingest:  rtmp://localhost:' + RTMP_PORT + '/live')
console.log('  HLS playback: http://127.0.0.1:' + HTTP_PORT + '/live/<stream_key>/index.m3u8')
console.log('  Media root:   ' + MEDIA_ROOT)
console.log('  FFmpeg:       ' + FFMPEG_PATH)
console.log('')

// Start HLS server first so 8000 is ours; then start NMS (RTMP 1935, FLV 8002)
hlsServer.listen(HTTP_PORT, '0.0.0.0', () => {
  console.log('[HLS] serving ' + MEDIA_ROOT + ' on http://0.0.0.0:' + HTTP_PORT)
  console.log('[HLS] health: http://127.0.0.1:' + HTTP_PORT + '/')
  nms.run()
})
hlsServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('[HLS] Port ' + HTTP_PORT + ' in use. Free it first, e.g.:')
    console.error('  lsof -ti :' + HTTP_PORT + ' | xargs kill -9')
    process.exit(1)
  }
  throw err
})

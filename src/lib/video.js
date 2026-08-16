/**
 * Utility functions for YouTube video parsing and normalization.
 */

export function parseYouTubeVideoId(url) {
  if (!url || typeof url !== 'string') return null
  const cleaned = url.trim()

  // Match youtube.com/watch?v=ID or &v=ID
  const watchMatch = cleaned.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]

  // Match youtu.be/ID
  const shortMatch = cleaned.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]

  // Match youtube.com/shorts/ID
  const shortsMatch = cleaned.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/)
  if (shortsMatch) return shortsMatch[1]

  // Match youtube.com/embed/ID
  const embedMatch = cleaned.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]

  // Match raw 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) return cleaned

  return null
}

export function getYouTubeEmbedUrl(rawUrl, options = {}) {
  const videoId = parseYouTubeVideoId(rawUrl)
  if (!videoId) return null

  const origin = options.origin || (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    iv_load_policy: '3',
    controls: '1',
  })

  if (options.autoplay) {
    params.set('autoplay', '1')
  }

  if (origin && origin.startsWith('http')) {
    params.set('origin', origin)
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`
}

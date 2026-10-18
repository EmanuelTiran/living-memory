const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com'])
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function parseTimestamp(value) {
  if (!value) return 0
  if (/^\d+s?$/.test(value)) return Number(value.replace(/s$/, ''))
  const parts = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  if (!parts || !parts.slice(1).some(Boolean)) return NaN
  return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
}

// Pure allowlist normalization: no fetching, redirects, embed markup, or tracking parameters.
export function normalizeYouTubeVideo(value) {
  if (typeof value !== 'string' || value.length > 2048) return null
  const input = value.trim()
  if (Array.from(input).some(character => character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127 || '\\<>'.includes(character))) return null
  let url
  try { url = new URL(input) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  let externalId
  if (YOUTUBE_HOSTS.has(url.hostname) && url.pathname === '/watch') {
    if (url.searchParams.getAll('v').length !== 1) return null
    externalId = url.searchParams.get('v')
  } else if (url.hostname === 'youtu.be') {
    externalId = url.pathname.slice(1)
  } else return null
  if (!VIDEO_ID.test(externalId)) return null
  if (url.searchParams.getAll('t').length > 1 || url.searchParams.getAll('start').length > 1) return null
  const hashTime = url.hash.startsWith('#t=') ? url.hash.slice(3) : ''
  const startSeconds = parseTimestamp(url.searchParams.get('t') ?? url.searchParams.get('start') ?? hashTime)
  if (!Number.isSafeInteger(startSeconds) || startSeconds < 0 || startSeconds > 604800) return null
  const canonicalUrl = `https://www.youtube.com/watch?v=${externalId}${startSeconds ? `&t=${startSeconds}s` : ''}`
  return { provider: 'youtube', canonicalUrl, externalId, startSeconds }
}

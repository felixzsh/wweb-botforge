import Fuse from 'fuse.js'

export function matchFuzzy(
  segments: string[],
  message: string,
  threshold: number
): string | null {
  if (segments.length === 0) return null

  const fuse = new Fuse(segments, {
    includeScore: true,
    threshold,
  })

  const results = fuse.search(message)
  if (results.length > 0 && results[0].score !== undefined && results[0].score <= threshold) {
    return segments[results[0].refIndex]
  }

  return null
}

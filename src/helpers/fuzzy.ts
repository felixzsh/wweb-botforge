import Fuse from 'fuse.js'

export interface FuzzyMatch {
  match: string
  phrase: string
  score: number
  threshold: number
}

export function matchFuzzy(
  segments: string[],
  message: string,
  threshold: number
): string | null {
  const result = matchFuzzyVerbose(segments, message, threshold)
  return result?.match || null
}

export function matchFuzzyVerbose(
  segments: string[],
  message: string,
  threshold: number
): FuzzyMatch | null {
  if (segments.length === 0) return null

  const fuse = new Fuse(segments, {
    includeScore: true,
    threshold,
  })

  const results = fuse.search(message)
  if (results.length > 0 && results[0].score !== undefined && results[0].score <= threshold) {
    return {
      match: segments[results[0].refIndex],
      phrase: message,
      score: results[0].score,
      threshold,
    }
  }

  return null
}

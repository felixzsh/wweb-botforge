import { getLogger } from '../helpers/logger'

export interface RequestPayload {
  senderPhone: string
  senderName?: string
  message: string
  timestamp: string
  botId: string
  botName: string
  requestName: string
  metadata: Record<string, any>
}

export interface RequestCall {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  body?: any
  timeout: number
  retries: number
}

export async function sendRequest(call: RequestCall): Promise<void> {
  const logger = getLogger()
  const maxRetries = call.retries || 1
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), call.timeout)

    try {
      const response = await fetch(call.url, {
        method: call.method,
        headers: {
          'Content-Type': 'application/json',
          ...call.headers,
        },
        body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.debug(`Request successful: ${call.url}`)
      return
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000
        logger.warn(`Request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms: ${lastError.message}`)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw new Error(`Request failed after ${maxRetries} attempts: ${lastError?.message}`)
}

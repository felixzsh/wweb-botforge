import { getLogger } from '../utils/logger'

export interface WebhookCall {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH'
  headers: Record<string, string>
  body?: any
  timeout: number
  retries: number
}

export async function sendWebhookRequest(call: WebhookCall): Promise<void> {
  const logger = getLogger()
  const maxRetries = call.retries || 1
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(call.url, {
        method: call.method,
        headers: {
          'Content-Type': 'application/json',
          ...call.headers,
        },
        body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
        signal: AbortSignal.timeout(call.timeout),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      logger.info(`Webhook request successful: ${call.url}`)
      return
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt - 1) * 1000
        logger.warn(`Webhook request failed (attempt ${attempt}/${maxRetries}), retrying in ${backoffMs}ms:`, lastError.message)
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  throw new Error(`Webhook request failed after ${maxRetries} attempts: ${lastError?.message}`)
}

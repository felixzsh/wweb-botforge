import { sendWebhookRequest, WebhookCall } from '../../../src/action/webhook'

describe('sendWebhookRequest', () => {
  let fetchMock: jest.Mock
  let originalFetch: typeof global.fetch

  beforeAll(() => {
    originalFetch = global.fetch
  })

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock as unknown as typeof global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('should succeed on 200 response', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 1,
    }

    await expect(sendWebhookRequest(call)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should throw on HTTP error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 1,
    }

    await expect(sendWebhookRequest(call)).rejects.toThrow('HTTP 500')
  })

  it('should retry on network error and succeed', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 2,
    }

    await expect(sendWebhookRequest(call)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('should throw after all retries fail', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 2,
    }

    await expect(sendWebhookRequest(call)).rejects.toThrow(
      'Webhook request failed after 2 attempts'
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('should send body as JSON', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 1,
      body: { message: 'hello' },
    }

    await sendWebhookRequest(call)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({ body: JSON.stringify({ message: 'hello' }) })
    )
  })

  it('should not send body when undefined', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 1,
    }

    await sendWebhookRequest(call)

    const callArgs = fetchMock.mock.calls[0][1]
    expect(callArgs.body).toBeUndefined()
  })

  it('should merge custom headers with Content-Type', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, statusText: 'OK' })

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      timeout: 5000,
      retries: 1,
    }

    await sendWebhookRequest(call)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        }),
      })
    )
  })

  it('should default to 1 retry when retries is 0', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'))

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 0,
    }

    await expect(sendWebhookRequest(call)).rejects.toThrow(
      'Webhook request failed after 1 attempts'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('should handle non-Error thrown values', async () => {
    fetchMock.mockRejectedValue('string error')

    const call: WebhookCall = {
      url: 'https://example.com/webhook',
      method: 'POST',
      headers: {},
      timeout: 5000,
      retries: 1,
    }

    await expect(sendWebhookRequest(call)).rejects.toThrow(
      'Webhook request failed after 1 attempts: string error'
    )
  })
})

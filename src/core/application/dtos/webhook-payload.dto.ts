/**
 * Data Transfer Object for webhook payload sent to external services
 */
export interface WebhookPayloadDTO {
  sender: string;
  message: string;
  timestamp: string;
  botId: string;
  botName: string;
  webhookName: string;
  webhookPattern: string;
  metadata: Record<string, any>;
}
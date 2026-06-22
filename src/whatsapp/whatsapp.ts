import { Message as WWebJSMessage } from 'whatsapp-web.js'

export enum WhatsAppMessageType {
  TEXT = 'chat',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT = 'contact',
  BUTTONS_RESPONSE = 'buttons_response',
  LIST_RESPONSE = 'list_response',
  TEMPLATE_BUTTON_REPLY = 'template_button_reply',
}

export enum WhatsAppConnectionState {
  CONNECTING = 'CONNECTING',
  AUTHENTICATING = 'AUTHENTICATING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED',
}

export interface WhatsAppSessionInfo {
  clientId: string
  phoneNumber?: string
  platform?: string
  pushname?: string
  wid?: string
  connected: boolean
  lastSeen?: Date
}

export interface WhatsAppMessageOptions {
  linkPreview?: boolean
  sendAudioAsVoice?: boolean
  sendVideoAsGif?: boolean
  sendMediaAsSticker?: boolean
  sendMediaAsDocument?: boolean
  sendMediaAsHd?: boolean
  isViewOnce?: boolean
  parseVCards?: boolean
  caption?: string
  quotedMessageId?: string
  groupMentions?: any[]
  mentions?: string[]
  sendSeen?: boolean
  invokedBotWid?: string
  stickerAuthor?: string
  stickerName?: string
  stickerCategories?: string[]
  ignoreQuoteErrors?: boolean
  waitUntilMsgSent?: boolean
  media?: any
}

export interface WhatsAppMediaInfo {
  mimetype: string
  filename?: string
  data: Buffer
}

export interface WhatsAppContact {
  id: string
  name?: string
  number: string
  isBusiness?: boolean
  isEnterprise?: boolean
}

export interface WhatsAppGroup {
  id: string
  name: string
  description?: string
  participants: WhatsAppContact[]
  isGroup: boolean
}

export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '')
}

export function extractPhoneNumberFromWid(wid: string): string {
  const match = wid.match(/^(\d+)@/)
  return match ? match[1] : wid
}

export function widToPhoneNumber(wid: string): string {
  const phone = extractPhoneNumberFromWid(wid)
  return normalizePhoneNumber(phone)
}

export function phoneNumberToWid(phoneNumber: string): string {
  const normalized = normalizePhoneNumber(phoneNumber)
  return `${normalized}@c.us`
}

export function isMediaMessage(messageType: WhatsAppMessageType): boolean {
  return [
    WhatsAppMessageType.IMAGE,
    WhatsAppMessageType.VIDEO,
    WhatsAppMessageType.AUDIO,
    WhatsAppMessageType.DOCUMENT,
    WhatsAppMessageType.STICKER,
  ].includes(messageType)
}

export function isInteractiveMessage(messageType: WhatsAppMessageType): boolean {
  return [
    WhatsAppMessageType.BUTTONS_RESPONSE,
    WhatsAppMessageType.LIST_RESPONSE,
    WhatsAppMessageType.TEMPLATE_BUTTON_REPLY,
  ].includes(messageType)
}

export function getFileExtension(mimetype: string): string {
  const extensions: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
  }

  return extensions[mimetype] || 'bin'
}

export function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function toDomainMessage(message: WWebJSMessage) {
  return {
    id: message.id._serialized,
    from: widToPhoneNumber(message.from),
    to: widToPhoneNumber(message.to),
    content: message.body,
    timestamp: new Date(message.timestamp * 1000),
    metadata: {
      hasMedia: message.hasMedia,
      type: message.type,
      fromMe: message.fromMe,
      isGroup: (message as any).isGroupMsg || false,
    },
  }
}

export function toWhatsAppFormat(message: { to: string; content: string; metadata?: any }) {
  return {
    to: phoneNumberToWid(message.to),
    content: message.content,
    options: message.metadata,
  }
}

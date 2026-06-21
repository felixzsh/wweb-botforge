export function validateBotId(id: string): void {
  if (!id || id.length < 3) {
    throw new Error('Bot ID must be at least 3 characters long')
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error('Bot ID can only contain lowercase letters, numbers and hyphens')
  }
}

export function validatePhoneNumber(phone: string): boolean {
  return /^\d{10,15}$/.test(phone)
}

export function validateBotName(name: string): void {
  if (!name || name.trim().length === 0) {
    throw new Error('Bot name cannot be empty')
  }
}

export function validatePriority(priority: number): void {
  if (priority < 0) {
    throw new Error('Priority must be non-negative')
  }
}

export function validateTypingDelay(delay: number): void {
  if (delay < 0) {
    throw new Error('Typing delay must be non-negative')
  }
}

export function validateQueueDelay(delay: number): void {
  if (delay < 0) {
    throw new Error('Queue delay must be non-negative')
  }
}



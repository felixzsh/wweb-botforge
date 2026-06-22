export function validateId(id: string, kind: string): void {
  if (!id || id.length < 3) {
    throw new Error(`${kind} ID must be at least 3 characters long`)
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    throw new Error(`${kind} ID can only contain lowercase letters, numbers and hyphens`)
  }
  if (/^[-]/.test(id)) {
    throw new Error(`${kind} ID cannot start with a hyphen`)
  }
  if (/[-]$/.test(id)) {
    throw new Error(`${kind} ID cannot end with a hyphen`)
  }
  if (/--/.test(id)) {
    throw new Error(`${kind} ID cannot contain consecutive hyphens`)
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

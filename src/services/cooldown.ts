export class CooldownService {
  private cooldowns: Map<string, Map<string, number>> = new Map()

  isOnCooldown(sender: string, key: string, cooldownMs: number): boolean {
    if (cooldownMs <= 0) return false

    const senderCooldowns = this.cooldowns.get(sender)
    if (!senderCooldowns) return false

    const lastTrigger = senderCooldowns.get(key)
    if (!lastTrigger) return false

    return Date.now() - lastTrigger < cooldownMs
  }

  setCooldown(sender: string, key: string): void {
    let senderCooldowns = this.cooldowns.get(sender)
    if (!senderCooldowns) {
      senderCooldowns = new Map()
      this.cooldowns.set(sender, senderCooldowns)
    }
    senderCooldowns.set(key, Date.now())
  }

  cleanupExpiredCooldowns(): void {
    const now = Date.now()
    const maxAge = 60 * 60 * 1000

    for (const [sender, keyMap] of this.cooldowns.entries()) {
      for (const [key, timestamp] of keyMap.entries()) {
        if (now - timestamp > maxAge) {
          keyMap.delete(key)
        }
      }
      if (keyMap.size === 0) {
        this.cooldowns.delete(sender)
      }
    }
  }

  getCooldownStatus(sender: string, key: string): { isOnCooldown: boolean; remainingMs: number; lastTrigger?: number } {
    const senderCooldowns = this.cooldowns.get(sender)
    const lastTrigger = senderCooldowns?.get(key)

    if (!lastTrigger) {
      return { isOnCooldown: false, remainingMs: 0 }
    }

    const now = Date.now()
    const elapsed = now - lastTrigger
    const isOnCooldown = elapsed < 30000
    const remainingMs = Math.max(0, 30000 - elapsed)

    return { isOnCooldown, remainingMs, lastTrigger }
  }

  clearAllCooldowns(): void {
    this.cooldowns.clear()
  }

  clearSenderCooldowns(sender: string): void {
    this.cooldowns.delete(sender)
  }
}

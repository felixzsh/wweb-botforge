/**
 * Service for managing cooldowns to prevent spam and abuse
 * Tracks cooldowns per sender-key combination to allow rate limiting
 */
export class CooldownService {
  /**
   * Tracks cooldowns per sender-key combination
   * Map<sender, Map<key, lastTriggerTimestamp>>
   */
  private cooldowns: Map<string, Map<string, number>> = new Map();

  /**
   * Check if a sender-key combination is on cooldown
   * @param sender - The sender identifier (phone number)
   * @param key - The cooldown key (pattern for auto-responses, webhook name, etc.)
   * @param cooldownMs - Cooldown duration in milliseconds
   * @returns true if on cooldown, false otherwise
   */
  isOnCooldown(sender: string, key: string, cooldownMs: number): boolean {
    if (cooldownMs <= 0) return false;

    const senderCooldowns = this.cooldowns.get(sender);
    if (!senderCooldowns) return false;

    const lastTrigger = senderCooldowns.get(key);
    if (!lastTrigger) return false;

    return Date.now() - lastTrigger < cooldownMs;
  }

  /**
   * Set cooldown timestamp for a sender-key combination
   * @param sender - The sender identifier (phone number)
   * @param key - The cooldown key (pattern for auto-responses, webhook name, etc.)
   */
  setCooldown(sender: string, key: string): void {
    let senderCooldowns = this.cooldowns.get(sender);
    if (!senderCooldowns) {
      senderCooldowns = new Map();
      this.cooldowns.set(sender, senderCooldowns);
    }
    senderCooldowns.set(key, Date.now());
  }

  /**
   * Clean up expired cooldowns to prevent memory leaks
   * Removes entries older than 1 hour
   */
  cleanupExpiredCooldowns(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [sender, keyMap] of this.cooldowns.entries()) {
      for (const [key, timestamp] of keyMap.entries()) {
        if (now - timestamp > maxAge) {
          keyMap.delete(key);
        }
      }
      if (keyMap.size === 0) {
        this.cooldowns.delete(sender);
      }
    }
  }

  /**
   * Get cooldown status for debugging/monitoring
   * @param sender - The sender identifier
   * @param key - The cooldown key
   * @returns object with cooldown information
   */
  getCooldownStatus(sender: string, key: string): { isOnCooldown: boolean; remainingMs: number; lastTrigger?: number } {
    const senderCooldowns = this.cooldowns.get(sender);
    const lastTrigger = senderCooldowns?.get(key);

    if (!lastTrigger) {
      return { isOnCooldown: false, remainingMs: 0 };
    }

    const now = Date.now();
    const elapsed = now - lastTrigger;
    const isOnCooldown = elapsed < 30000; // Assuming 30s default for status check
    const remainingMs = Math.max(0, 30000 - elapsed);

    return { isOnCooldown, remainingMs, lastTrigger };
  }

  /**
   * Clear all cooldowns (useful for testing or admin commands)
   */
  clearAllCooldowns(): void {
    this.cooldowns.clear();
  }

  /**
   * Clear cooldowns for a specific sender
   * @param sender - The sender identifier
   */
  clearSenderCooldowns(sender: string): void {
    this.cooldowns.delete(sender);
  }
}
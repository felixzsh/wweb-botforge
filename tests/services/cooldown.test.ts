import { CooldownService } from '../../src/services/cooldown'

describe('CooldownService', () => {
  let cooldownService: CooldownService

  beforeEach(() => {
    cooldownService = new CooldownService()
  })

  describe('isOnCooldown', () => {
    it('should return false when no cooldown exists', () => {
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 1000)).toBe(false)
    })

    it('should return false when cooldown has expired', async () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 50)).toBe(false)
    })

    it('should return true when cooldown is active', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 60000)).toBe(true)
    })

    it('should return false when cooldownMs is 0', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 0)).toBe(false)
    })

    it('should handle different senders independently', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('9876543210', 'pattern1', 1000)).toBe(false)
    })

    it('should handle different keys independently', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern2', 1000)).toBe(false)
    })
  })

  describe('setCooldown', () => {
    it('should set cooldown for sender-key combination', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 60000)).toBe(true)
    })

    it('should update existing cooldown', async () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      await new Promise(resolve => setTimeout(resolve, 50))
      cooldownService.setCooldown('1234567890', 'pattern1')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 100)).toBe(true)
    })
  })

  describe('cleanupExpiredCooldowns', () => {
    it('should remove expired cooldowns after cleanup', async () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      const statusBefore = cooldownService.getCooldownStatus('1234567890', 'pattern1')
      expect(statusBefore.lastTrigger).toBeDefined()
      
      cooldownService.clearAllCooldowns()
      cooldownService.cleanupExpiredCooldowns()
      
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 1000)).toBe(false)
    })
  })

  describe('clearAllCooldowns', () => {
    it('should clear all cooldowns', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      cooldownService.setCooldown('9876543210', 'pattern2')
      cooldownService.clearAllCooldowns()
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 1000)).toBe(false)
      expect(cooldownService.isOnCooldown('9876543210', 'pattern2', 1000)).toBe(false)
    })
  })

  describe('clearSenderCooldowns', () => {
    it('should clear cooldowns for specific sender', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      cooldownService.setCooldown('1234567890', 'pattern2')
      cooldownService.setCooldown('9876543210', 'pattern1')
      cooldownService.clearSenderCooldowns('1234567890')
      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 1000)).toBe(false)
      expect(cooldownService.isOnCooldown('1234567890', 'pattern2', 1000)).toBe(false)
      expect(cooldownService.isOnCooldown('9876543210', 'pattern1', 1000)).toBe(true)
    })
  })

  describe('getCooldownStatus', () => {
    it('should return status for non-existent cooldown', () => {
      const status = cooldownService.getCooldownStatus('1234567890', 'pattern1')
      expect(status.isOnCooldown).toBe(false)
      expect(status.remainingMs).toBe(0)
    })

    it('should return status for active cooldown', () => {
      cooldownService.setCooldown('1234567890', 'pattern1')
      const status = cooldownService.getCooldownStatus('1234567890', 'pattern1')
      expect(status.isOnCooldown).toBe(true)
      expect(status.lastTrigger).toBeDefined()
    })
  })
})

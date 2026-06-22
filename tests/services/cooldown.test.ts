import { CooldownService } from '../../src/action/cooldown'

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
    it('should remove cooldowns older than max age', () => {
      const past = Date.now() - 60 * 60 * 1000 - 1000
      jest.spyOn(Date, 'now').mockReturnValueOnce(past)

      cooldownService.setCooldown('1234567890', 'pattern1')

      jest.spyOn(Date, 'now').mockReturnValueOnce(past + 60 * 60 * 1000 + 2000)

      cooldownService.cleanupExpiredCooldowns()

      expect(cooldownService.isOnCooldown('1234567890', 'pattern1', 60000)).toBe(false)
    })

    it('should clean up sender entry when all its keys expire', () => {
      const past = Date.now() - 60 * 60 * 1000 - 1000
      jest.spyOn(Date, 'now').mockReturnValueOnce(past)

      cooldownService.setCooldown('1234567890', 'pattern1')

      jest.spyOn(Date, 'now').mockReturnValueOnce(past + 60 * 60 * 1000 + 2000)

      cooldownService.cleanupExpiredCooldowns()

      const status = cooldownService.getCooldownStatus('1234567890', 'pattern1')
      expect(status.lastTrigger).toBeUndefined()
    })

    it('should only remove expired keys and keep non-expired ones', () => {
      const past = Date.now() - 60 * 60 * 1000 - 1000
      jest.spyOn(Date, 'now').mockReturnValueOnce(past)

      cooldownService.setCooldown('1234567890', 'expired-key')

      const present = Date.now()
      jest.spyOn(Date, 'now').mockReturnValueOnce(present)

      cooldownService.setCooldown('1234567890', 'active-key')

      jest.spyOn(Date, 'now').mockReturnValueOnce(past + 60 * 60 * 1000 + 2000)

      cooldownService.cleanupExpiredCooldowns()

      expect(cooldownService.isOnCooldown('1234567890', 'expired-key', 60000)).toBe(false)
      expect(cooldownService.isOnCooldown('1234567890', 'active-key', 60000)).toBe(true)
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

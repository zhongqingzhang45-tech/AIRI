import type { BillingService } from '../../services/domain/billing/billing-service'
import type { VoicePackService } from '../../services/domain/voice-packs'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'

import { authGuard } from '../../middlewares/auth'
import { createNotFoundError } from '../../utils/error'

function publicVoicePack(pack: Awaited<ReturnType<VoicePackService['listEnabled']>>[number]) {
  return {
    id: pack.id,
    name: pack.name,
    description: pack.description,
    voiceId: pack.voiceId,
    params: pack.params,
    costMultiplier: pack.costMultiplier,
    priceCredit: pack.priceCredit,
    enabled: pack.enabled,
    createdAt: pack.createdAt,
    updatedAt: pack.updatedAt,
  }
}

/**
 * User-facing Voice Pack routes.
 *
 * Mounted at `/api/v1/voice-packs`. Only enabled packs are exposed so disabled
 * curated entries remain available to historical character snapshots but cannot
 * be newly selected.
 */
export function createVoicePackRoutes(service: VoicePackService, billingService: BillingService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)
    .get('/', async (c) => {
      const packs = await service.listEnabled()
      return c.json(packs.map(publicVoicePack))
    })

    .get('/:id/unlock-status', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')

      const pack = (await service.listEnabled()).find(p => p.id === id)
      if (!pack)
        throw createNotFoundError()

      const isUnlocked = pack.priceCredit === 0 || await billingService.isVoicePackUnlocked(user.id, id)

      return c.json({
        unlocked: isUnlocked,
        priceCredit: pack.priceCredit,
        isFree: pack.priceCredit === 0,
      })
    })

    .post('/:id/unlock', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')

      const pack = (await service.listEnabled()).find(p => p.id === id)
      if (!pack)
        throw createNotFoundError()

      if (pack.priceCredit <= 0)
        return c.json({ unlocked: true, message: 'This voice pack is free' })

      const alreadyUnlocked = await billingService.isVoicePackUnlocked(user.id, id)
      if (alreadyUnlocked)
        return c.json({ unlocked: true, message: 'Already unlocked' })

      const result = await billingService.consumeFluxForVoicePackUnlock({
        userId: user.id,
        voicePackId: id,
        priceCredit: pack.priceCredit,
        requestId: `voice-pack-unlock-${user.id}-${id}`,
      })

      return c.json({
        unlocked: true,
        charged: result.charged,
        balanceAfter: result.flux,
      })
    })
}

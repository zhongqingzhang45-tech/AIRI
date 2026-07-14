import type { BillingService } from '../../services/domain/billing/billing-service'
import type { CharacterService } from '../../services/domain/characters'
import type { HonoEnv } from '../../types/hono'

import { Hono } from 'hono'
import { safeParse } from 'valibot'

import { authGuard } from '../../middlewares/auth'
import { createBadRequestError, createForbiddenError, createNotFoundError } from '../../utils/error'
import { CreateCharacterSchema, UpdateCharacterSchema } from './schema'

export function createCharacterRoutes(characterService: CharacterService, billingService: BillingService) {
  return new Hono<HonoEnv>()
    .use('*', authGuard)

    .get('/', async (c) => {
      const user = c.get('user')!
      const all = c.req.query('all') === 'true'

      const characters = all
        ? await characterService.findAll()
        : await characterService.findByOwnerId(user.id)
      return c.json(characters)
    })

    .get('/:id', async (c) => {
      const id = c.req.param('id')
      const character = await characterService.findById(id)
      if (!character)
        throw createNotFoundError()

      return c.json(character)
    })

    .post('/', async (c) => {
      const user = c.get('user')!

      const body = await c.req.json()
      const result = safeParse(CreateCharacterSchema, body)

      if (!result.success) {
        throw createBadRequestError('Invalid Request', 'INVALID_REQUEST', result.issues)
      }

      // @ts-expect-error - TODO: Fix this
      const character = await characterService.create({
        ...result.output,
        character: {
          ...result.output.character,
          ownerId: user.id,
          creatorId: user.id,
        },
      })

      return c.json(character, 201)
    })

    .patch('/:id', async (c) => {
      const user = c.get('user')!

      const id = c.req.param('id')
      const body = await c.req.json()
      const result = safeParse(UpdateCharacterSchema, body)

      if (!result.success) {
        throw createBadRequestError('Invalid Request', 'INVALID_REQUEST', result.issues)
      }

      // TODO: Move ownership checks into the service layer with an actor-aware API such as updateByOwner(user.id, id, input).
      const existing = await characterService.findById(id)
      if (!existing)
        throw createNotFoundError()
      if (existing.ownerId !== user.id)
        throw createForbiddenError()

      const updated = await characterService.update(id, result.output)
      return c.json(updated)
    })

    .delete('/:id', async (c) => {
      const user = c.get('user')!

      const id = c.req.param('id')
      // TODO: Move ownership checks into the service layer with an actor-aware API such as deleteByOwner(user.id, id).
      const existing = await characterService.findById(id)
      if (!existing)
        throw createNotFoundError()
      if (existing.ownerId !== user.id)
        throw createForbiddenError()

      await characterService.delete(id)
      return c.body(null, 204)
    })

    .post('/:id/like', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')
      const result = await characterService.like(user.id, id)
      return c.json(result)
    })

    .post('/:id/bookmark', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')
      const result = await characterService.bookmark(user.id, id)
      return c.json(result)
    })

    .get('/:id/unlock-status', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')

      const character = await characterService.findById(id)
      if (!character)
        throw createNotFoundError()

      const isOwner = character.ownerId === user.id || character.creatorId === user.id
      const isUnlocked = isOwner || await billingService.isCharacterUnlocked(user.id, id)
      const priceCredit = Number(character.priceCredit)

      return c.json({
        unlocked: isUnlocked,
        isOwner,
        priceCredit,
        isFree: priceCredit === 0,
      })
    })

    .post('/:id/unlock', async (c) => {
      const user = c.get('user')!
      const id = c.req.param('id')

      const character = await characterService.findById(id)
      if (!character)
        throw createNotFoundError()

      // Owners and creators have implicit access.
      if (character.ownerId === user.id || character.creatorId === user.id)
        return c.json({ unlocked: true, message: 'You already own this character' })

      const priceCredit = Number(character.priceCredit)
      if (priceCredit <= 0)
        return c.json({ unlocked: true, message: 'This character is free' })

      // Idempotency: already unlocked → no charge.
      const alreadyUnlocked = await billingService.isCharacterUnlocked(user.id, id)
      if (alreadyUnlocked)
        return c.json({ unlocked: true, message: 'Already unlocked' })

      const result = await billingService.consumeFluxForCharacterUnlock({
        userId: user.id,
        characterId: id,
        priceCredit,
        requestId: `character-unlock-${user.id}-${id}`,
      })

      return c.json({
        unlocked: true,
        charged: result.charged,
        balanceAfter: result.flux,
      })
    })
}

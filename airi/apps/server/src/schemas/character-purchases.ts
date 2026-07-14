import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm/relations'

import { user } from './accounts'
import { character } from './characters'

// NOTICE: bare userId is intentional — no FK to user.id. better-auth hard-deletes
// the user row; a cascade would wipe these soft-delete archive rows kept for
// billing audit. See `apps/server/docs/ai-context/account-deletion.md`.

/**
 * Character unlock purchases — records when a user pays Flux to unlock a
 * premium character created by another user. The composite primary key
 * (userId, characterId) ensures a user can only unlock once.
 *
 * `pricePaid` is the Flux amount charged at purchase time (snapshot of
 * `character.priceCredit`), and `fluxTransactionId` links back to the
 * ledger row for audit.
 */
export const characterPurchases = pgTable(
  'user_character_purchases',
  {
    userId: text('user_id').notNull(),
    characterId: text('character_id').notNull().references(() => character.id, { onDelete: 'cascade' }),
    pricePaid: integer('price_paid').notNull(),
    fluxTransactionId: text('flux_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  table => [
    primaryKey({ columns: [table.userId, table.characterId] }),
  ],
)

export type CharacterPurchase = InferSelectModel<typeof characterPurchases>
export type NewCharacterPurchase = InferInsertModel<typeof characterPurchases>

export const characterPurchasesRelations = relations(
  characterPurchases,
  ({ one }) => ({
    user: one(user, {
      fields: [characterPurchases.userId],
      references: [user.id],
    }),
    character: one(character, {
      fields: [characterPurchases.characterId],
      references: [character.id],
    }),
  }),
)

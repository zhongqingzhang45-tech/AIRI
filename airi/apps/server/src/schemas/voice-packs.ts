import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'

import { boolean, integer, jsonb, pgTable, primaryKey, real, text, timestamp } from 'drizzle-orm/pg-core'

import { nanoid } from '../utils/id'

export interface VoicePackParams {
  pitch?: number
  volume?: number
  rate?: number
}

export const voicePacks = pgTable(
  'voice_packs',
  {
    id: text('id').primaryKey().$defaultFn(() => nanoid()),
    name: text('name').notNull(),
    description: text('description'),

    provider: text('provider').notNull(),
    model: text('model').notNull(),
    voiceId: text('voice_id').notNull(),
    upstreamVoiceId: text('upstream_voice_id').notNull(),
    ttsModelId: text('tts_model_id').notNull(),
    params: jsonb('params').notNull().$type<VoicePackParams>().default({}),
    costMultiplier: real('cost_multiplier').notNull().default(1),
    priceCredit: integer('price_credit').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
)

export type VoicePack = InferSelectModel<typeof voicePacks>
export type NewVoicePack = InferInsertModel<typeof voicePacks>

/**
 * Voice pack unlock purchases — records when a user pays Flux to unlock a
 * premium voice pack. The composite primary key (userId, voicePackId)
 * ensures a user can only unlock once.
 */
export const voicePackPurchases = pgTable(
  'user_voice_pack_purchases',
  {
    userId: text('user_id').notNull(),
    voicePackId: text('voice_pack_id').notNull().references(() => voicePacks.id, { onDelete: 'cascade' }),
    pricePaid: integer('price_paid').notNull(),
    fluxTransactionId: text('flux_transaction_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'),
  },
  table => [
    primaryKey({ columns: [table.userId, table.voicePackId] }),
  ],
)

export type VoicePackPurchase = InferSelectModel<typeof voicePackPurchases>
export type NewVoicePackPurchase = InferInsertModel<typeof voicePackPurchases>

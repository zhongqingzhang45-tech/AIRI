CREATE TABLE "user_character_purchases" (
	"user_id" text NOT NULL,
	"character_id" text NOT NULL,
	"price_paid" integer NOT NULL,
	"flux_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_character_purchases_user_id_character_id_pk" PRIMARY KEY("user_id","character_id")
);
--> statement-breakpoint
CREATE TABLE "user_voice_pack_purchases" (
	"user_id" text NOT NULL,
	"voice_pack_id" text NOT NULL,
	"price_paid" integer NOT NULL,
	"flux_transaction_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "user_voice_pack_purchases_user_id_voice_pack_id_pk" PRIMARY KEY("user_id","voice_pack_id")
);
--> statement-breakpoint
ALTER TABLE "voice_packs" ADD COLUMN "price_credit" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_character_purchases" ADD CONSTRAINT "user_character_purchases_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_voice_pack_purchases" ADD CONSTRAINT "user_voice_pack_purchases_voice_pack_id_voice_packs_id_fk" FOREIGN KEY ("voice_pack_id") REFERENCES "public"."voice_packs"("id") ON DELETE cascade ON UPDATE no action;
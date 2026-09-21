ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_token" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invite_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pairing_code" varchar(12);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "pairing_code_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "users_invite_token_unique" ON "users" USING btree ("invite_token");--> statement-breakpoint
CREATE UNIQUE INDEX "users_pairing_code_unique" ON "users" USING btree ("pairing_code");
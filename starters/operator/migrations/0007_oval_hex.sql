CREATE TABLE "promotional_offer_scheduler_state" (
	"id" text PRIMARY KEY NOT NULL,
	"singleton_key" text DEFAULT 'singleton' NOT NULL,
	"last_tick" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_pofs_singleton" ON "promotional_offer_scheduler_state" USING btree ("singleton_key");
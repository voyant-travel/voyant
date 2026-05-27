CREATE TYPE "public"."extra_collection_mode" AS ENUM('booking_total', 'cash_on_trip', 'external', 'included', 'none');--> statement-breakpoint
CREATE TYPE "public"."extra_participant_selection_status" AS ENUM('selected', 'cancelled', 'fulfilled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."extra_collection_status" AS ENUM('not_required', 'pending', 'collected', 'waived', 'refunded');--> statement-breakpoint
ALTER TABLE "product_extras" ADD COLUMN "collection_mode" "extra_collection_mode" DEFAULT 'booking_total' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_extras" ADD COLUMN "show_on_slot_manifest" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE "extra_participant_selections" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"booking_item_id" text,
	"traveler_id" text NOT NULL,
	"product_extra_id" text NOT NULL,
	"option_extra_config_id" text,
	"status" "extra_participant_selection_status" DEFAULT 'selected' NOT NULL,
	"collection_mode" "extra_collection_mode" DEFAULT 'booking_total' NOT NULL,
	"collection_status" "extra_collection_status" DEFAULT 'not_required' NOT NULL,
	"collection_currency" text,
	"collection_amount_cents" integer,
	"collected_at" timestamp with time zone,
	"collected_by" text,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "extra_participant_selections" ADD CONSTRAINT "extra_participant_selections_product_extra_id_product_extras_id_fk" FOREIGN KEY ("product_extra_id") REFERENCES "public"."product_extras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extra_participant_selections" ADD CONSTRAINT "extra_participant_selections_option_extra_config_id_option_extra_configs_id_fk" FOREIGN KEY ("option_extra_config_id") REFERENCES "public"."option_extra_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_extra_participant_selections_booking_updated" ON "extra_participant_selections" USING btree ("booking_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_extra_participant_selections_traveler_updated" ON "extra_participant_selections" USING btree ("traveler_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_extra_participant_selections_extra_updated" ON "extra_participant_selections" USING btree ("product_extra_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_extra_participant_selections_status_updated" ON "extra_participant_selections" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_extra_participant_selections_collection_updated" ON "extra_participant_selections" USING btree ("collection_status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_extra_participant_selection" ON "extra_participant_selections" USING btree ("booking_id","traveler_id","product_extra_id");

CREATE TABLE "departure_price_overrides" (
  "id" text PRIMARY KEY NOT NULL,
  "departure_id" text NOT NULL,
  "option_id" text NOT NULL,
  "option_unit_id" text NOT NULL,
  "price_catalog_id" text NOT NULL,
  "sell_amount_cents" integer NOT NULL,
  "cost_amount_cents" integer,
  "notes" text,
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "departure_price_overrides"
  ADD CONSTRAINT "departure_price_overrides_price_catalog_id_price_catalogs_id_fk"
  FOREIGN KEY ("price_catalog_id") REFERENCES "public"."price_catalogs"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_departure_price_overrides_target"
  ON "departure_price_overrides" USING btree ("departure_id", "option_unit_id", "price_catalog_id");
--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_departure"
  ON "departure_price_overrides" USING btree ("departure_id", "active");
--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_option"
  ON "departure_price_overrides" USING btree ("option_id", "active");
--> statement-breakpoint
CREATE INDEX "idx_departure_price_overrides_catalog"
  ON "departure_price_overrides" USING btree ("price_catalog_id", "active");

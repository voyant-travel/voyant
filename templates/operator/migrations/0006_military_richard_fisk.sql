CREATE TYPE "public"."promotional_offer_discount_type" AS ENUM('percentage', 'fixed_amount');--> statement-breakpoint
CREATE TABLE "promotional_offer_products" (
	"offer_id" text NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "promotional_offer_products_offer_id_product_id_pk" PRIMARY KEY("offer_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "promotional_offer_redemptions" (
	"id" text PRIMARY KEY NOT NULL,
	"offer_id" text NOT NULL,
	"booking_id" text NOT NULL,
	"code_used" text,
	"discount_applied_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotional_offers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"discount_type" "promotional_offer_discount_type" NOT NULL,
	"discount_percent" numeric(5, 2),
	"discount_amount_cents" integer,
	"currency" text,
	"scope" jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"code" text,
	"stackable" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotional_offer_products" ADD CONSTRAINT "promotional_offer_products_offer_id_promotional_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."promotional_offers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotional_offer_redemptions" ADD CONSTRAINT "promotional_offer_redemptions_offer_id_promotional_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."promotional_offers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pop_product" ON "promotional_offer_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_por_offer" ON "promotional_offer_redemptions" USING btree ("offer_id");--> statement-breakpoint
CREATE INDEX "idx_por_booking" ON "promotional_offer_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_por_offer_booking" ON "promotional_offer_redemptions" USING btree ("offer_id","booking_id");--> statement-breakpoint
CREATE INDEX "idx_promotional_offers_active_validity" ON "promotional_offers" USING btree ("active","valid_from","valid_until");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_promotional_offers_slug_active" ON "promotional_offers" USING btree ("slug") WHERE active = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_promotional_offers_code_active" ON "promotional_offers" USING btree (lower(code)) WHERE code is not null and active = true;
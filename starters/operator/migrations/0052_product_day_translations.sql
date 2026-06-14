CREATE TABLE IF NOT EXISTS "product_day_translations" (
	"id" text PRIMARY KEY NOT NULL,
	"day_id" text NOT NULL,
	"language_tag" text NOT NULL,
	"title" text,
	"description" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_day_translations" ADD CONSTRAINT "product_day_translations_day_id_product_days_id_fk" FOREIGN KEY ("day_id") REFERENCES "public"."product_days"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_day_translations_day" ON "product_day_translations" USING btree ("day_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_product_day_translations_language" ON "product_day_translations" USING btree ("language_tag");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_product_day_translations_day_language" ON "product_day_translations" USING btree ("day_id","language_tag");

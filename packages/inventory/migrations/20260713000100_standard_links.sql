CREATE TABLE IF NOT EXISTS "relationships_organization_products_product" (
	"id" text PRIMARY KEY NOT NULL,
	"relationships_organization_id" text NOT NULL,
	"products_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "relationships_person_products_product" (
	"id" text PRIMARY KEY NOT NULL,
	"relationships_person_id" text NOT NULL,
	"products_product_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_organization_products_product_pair_idx" ON "relationships_organization_products_product" USING btree ("relationships_organization_id","products_product_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationships_organization_products_product_l_idx" ON "relationships_organization_products_product" USING btree ("relationships_organization_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_organization_products_product_r_uniq" ON "relationships_organization_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_person_products_product_pair_idx" ON "relationships_person_products_product" USING btree ("relationships_person_id","products_product_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationships_person_products_product_l_idx" ON "relationships_person_products_product" USING btree ("relationships_person_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_person_products_product_r_uniq" ON "relationships_person_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;

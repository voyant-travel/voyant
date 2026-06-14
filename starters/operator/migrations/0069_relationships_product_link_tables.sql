DO $$
BEGIN
	IF to_regclass('public.crm_organization_products_product') IS NOT NULL
		AND to_regclass('public.relationships_organization_products_product') IS NULL THEN
		ALTER TABLE "crm_organization_products_product" RENAME TO "relationships_organization_products_product";
		ALTER TABLE "relationships_organization_products_product" RENAME COLUMN "crm_organization_id" TO "relationships_organization_id";
	ELSIF to_regclass('public.crm_organization_products_product') IS NOT NULL
		AND to_regclass('public.relationships_organization_products_product') IS NOT NULL THEN
		INSERT INTO "relationships_organization_products_product" (
			"id",
			"relationships_organization_id",
			"products_product_id",
			"created_at",
			"updated_at",
			"deleted_at"
		)
		SELECT
			"id",
			"crm_organization_id",
			"products_product_id",
			"created_at",
			"updated_at",
			"deleted_at"
		FROM "crm_organization_products_product"
		ON CONFLICT DO NOTHING;

		DROP TABLE "crm_organization_products_product";
	END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.crm_person_products_product') IS NOT NULL
		AND to_regclass('public.relationships_person_products_product') IS NULL THEN
		ALTER TABLE "crm_person_products_product" RENAME TO "relationships_person_products_product";
		ALTER TABLE "relationships_person_products_product" RENAME COLUMN "crm_person_id" TO "relationships_person_id";
	ELSIF to_regclass('public.crm_person_products_product') IS NOT NULL
		AND to_regclass('public.relationships_person_products_product') IS NOT NULL THEN
		INSERT INTO "relationships_person_products_product" (
			"id",
			"relationships_person_id",
			"products_product_id",
			"created_at",
			"updated_at",
			"deleted_at"
		)
		SELECT
			"id",
			"crm_person_id",
			"products_product_id",
			"created_at",
			"updated_at",
			"deleted_at"
		FROM "crm_person_products_product"
		ON CONFLICT DO NOTHING;

		DROP TABLE "crm_person_products_product";
	END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_organization_products_product_pair_idx" RENAME TO "relationships_organization_products_product_pair_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_organization_products_product_l_idx" RENAME TO "relationships_organization_products_product_l_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_organization_products_product_r_uniq" RENAME TO "relationships_organization_products_product_r_uniq";
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_person_products_product_pair_idx" RENAME TO "relationships_person_products_product_pair_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_person_products_product_l_idx" RENAME TO "relationships_person_products_product_l_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "crm_person_products_product_r_uniq" RENAME TO "relationships_person_products_product_r_uniq";
--> statement-breakpoint
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
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_organization_products_product_pair_idx" ON "relationships_organization_products_product" USING btree ("relationships_organization_id","products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationships_organization_products_product_l_idx" ON "relationships_organization_products_product" USING btree ("relationships_organization_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_organization_products_product_r_uniq" ON "relationships_organization_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_person_products_product_pair_idx" ON "relationships_person_products_product" USING btree ("relationships_person_id","products_product_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relationships_person_products_product_l_idx" ON "relationships_person_products_product" USING btree ("relationships_person_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relationships_person_products_product_r_uniq" ON "relationships_person_products_product" USING btree ("products_product_id") WHERE "deleted_at" IS NULL;

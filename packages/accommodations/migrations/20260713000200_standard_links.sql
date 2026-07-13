CREATE TABLE IF NOT EXISTS "mice_program_accommodations_roomBlock" (
	"id" text PRIMARY KEY NOT NULL,
	"mice_program_id" text NOT NULL,
	"accommodations_roomBlock_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operations_property_accommodations_roomBlock" (
	"id" text PRIMARY KEY NOT NULL,
	"operations_property_id" text NOT NULL,
	"accommodations_roomBlock_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers_supplier_accommodations_roomBlock" (
	"id" text PRIMARY KEY NOT NULL,
	"suppliers_supplier_id" text NOT NULL,
	"accommodations_roomBlock_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mice_program_accommodations_roomBlock_pair_idx" ON "mice_program_accommodations_roomBlock" USING btree ("mice_program_id","accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mice_program_accommodations_roomBlock_l_idx" ON "mice_program_accommodations_roomBlock" USING btree ("mice_program_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "mice_program_accommodations_roomBlock_r_uniq" ON "mice_program_accommodations_roomBlock" USING btree ("accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operations_property_accommodations_roomBlock_pair_idx" ON "operations_property_accommodations_roomBlock" USING btree ("operations_property_id","accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "operations_property_accommodations_roomBlock_l_idx" ON "operations_property_accommodations_roomBlock" USING btree ("operations_property_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "operations_property_accommodations_roomBlock_r_uniq" ON "operations_property_accommodations_roomBlock" USING btree ("accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_supplier_accommodations_roomBlock_pair_idx" ON "suppliers_supplier_accommodations_roomBlock" USING btree ("suppliers_supplier_id","accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_supplier_accommodations_roomBlock_l_idx" ON "suppliers_supplier_accommodations_roomBlock" USING btree ("suppliers_supplier_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_supplier_accommodations_roomBlock_r_uniq" ON "suppliers_supplier_accommodations_roomBlock" USING btree ("accommodations_roomBlock_id") WHERE "deleted_at" IS NULL;

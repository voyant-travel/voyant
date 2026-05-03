CREATE TABLE "catalog_demo_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_module" text DEFAULT 'products' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"available" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_demo_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_id" text,
	"entity_id" text NOT NULL,
	"entity_module" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"priced_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"party" jsonb,
	"payment_intent" jsonb,
	"cancelled_at" timestamp with time zone,
	"cancelled_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_demo_orders" ADD CONSTRAINT "catalog_demo_orders_inventory_id_catalog_demo_inventory_id_fk" FOREIGN KEY ("inventory_id") REFERENCES "public"."catalog_demo_inventory"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_catalog_demo_inventory_module" ON "catalog_demo_inventory" USING btree ("entity_module");--> statement-breakpoint
CREATE INDEX "idx_catalog_demo_inventory_available_module" ON "catalog_demo_inventory" USING btree ("available","entity_module");--> statement-breakpoint
CREATE INDEX "idx_catalog_demo_orders_status_created" ON "catalog_demo_orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_catalog_demo_orders_entity" ON "catalog_demo_orders" USING btree ("entity_id","entity_module");--> statement-breakpoint
CREATE INDEX "idx_catalog_demo_orders_inventory" ON "catalog_demo_orders" USING btree ("inventory_id");
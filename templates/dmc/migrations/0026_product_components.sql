CREATE TABLE IF NOT EXISTS "product_components" (
  "id" text PRIMARY KEY NOT NULL,
  "product_id" text NOT NULL,
  "component_kind" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "description" text,
  "selection" text DEFAULT 'fixed' NOT NULL,
  "commitment_boundary" text DEFAULT 'internal' NOT NULL,
  "price_disposition" text DEFAULT 'included' NOT NULL,
  "required" boolean DEFAULT false NOT NULL,
  "quantity" integer,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "binding" jsonb NOT NULL,
  "choices" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "media" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_components_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "idx_product_components_product"
  ON "product_components" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_product_components_product_sort"
  ON "product_components" ("product_id", "sort_order", "created_at");
CREATE INDEX IF NOT EXISTS "idx_product_components_kind"
  ON "product_components" ("component_kind");
CREATE INDEX IF NOT EXISTS "idx_product_components_commitment"
  ON "product_components" ("commitment_boundary");

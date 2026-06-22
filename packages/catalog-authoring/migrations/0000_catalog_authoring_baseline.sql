CREATE TABLE "product_authoring_requests" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"operation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_par_product" ON "product_authoring_requests" USING btree ("product_id");
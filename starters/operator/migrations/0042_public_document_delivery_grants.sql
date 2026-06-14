CREATE TABLE IF NOT EXISTS "public_document_delivery_grants" (
  "id" text PRIMARY KEY NOT NULL,
  "token_hash" text NOT NULL,
  "storage_key" text NOT NULL,
  "storage_provider" text,
  "filename" text,
  "content_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "source_module" text,
  "source_entity" text,
  "source_id" text,
  "created_by" text,
  "created_by_type" text,
  "metadata" jsonb,
  "access_count" integer DEFAULT 0 NOT NULL,
  "last_accessed_at" timestamp with time zone,
  "last_accessed_ip" text,
  "last_accessed_user_agent" text,
  "revoked_at" timestamp with time zone,
  "revoked_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);--> statement-breakpoint
ALTER TABLE "public_document_delivery_grants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uidx_public_document_delivery_grants_token_hash"
  ON "public_document_delivery_grants" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_public_document_delivery_grants_expires_at"
  ON "public_document_delivery_grants" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_public_document_delivery_grants_source"
  ON "public_document_delivery_grants" USING btree ("source_module","source_entity","source_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_public_document_delivery_grants_revoked_at"
  ON "public_document_delivery_grants" USING btree ("revoked_at");

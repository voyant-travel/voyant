CREATE TABLE IF NOT EXISTS "promotion_reindex_state" (
  "id" text PRIMARY KEY DEFAULT 'all-products' NOT NULL,
  "requested_generation" integer DEFAULT 0 NOT NULL,
  "completed_generation" integer DEFAULT 0 NOT NULL,
  "claimed_generation" integer,
  "lease_owner" text,
  "lease_until" timestamp with time zone,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

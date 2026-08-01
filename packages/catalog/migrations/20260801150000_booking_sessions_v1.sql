CREATE TABLE "booking_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "capability_hash" text,
  "actor_kind" text NOT NULL,
  "target_kind" text NOT NULL,
  "product_id" text,
  "catalog_item_id" text,
  "state" text NOT NULL,
  "revision" integer NOT NULL,
  "state_payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone,
  "abandoned_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_session_quotes" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "session_revision" integer NOT NULL,
  "state" text NOT NULL,
  "pricing" jsonb NOT NULL,
  "price_fingerprint" text NOT NULL,
  "quoted_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "booking_session_holds" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "quote_id" text NOT NULL,
  "target" jsonb NOT NULL,
  "quantity" integer NOT NULL,
  "state" text NOT NULL,
  "capacity_key" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "converted_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_session_commits" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "request_fingerprint" text NOT NULL,
  "outcome" jsonb NOT NULL,
  "booking_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_booking_sessions_state_expires" ON "booking_sessions" USING btree ("state","expires_at");
--> statement-breakpoint
CREATE INDEX "idx_booking_sessions_product" ON "booking_sessions" USING btree ("product_id");
--> statement-breakpoint
CREATE INDEX "idx_booking_sessions_catalog_item" ON "booking_sessions" USING btree ("catalog_item_id");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_quotes_session" ON "booking_session_quotes" USING btree ("session_id","session_revision");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_quotes_expires" ON "booking_session_quotes" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_holds_session" ON "booking_session_holds" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_holds_capacity" ON "booking_session_holds" USING btree ("capacity_key","state");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_holds_expires" ON "booking_session_holds" USING btree ("expires_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_booking_session_commits_session_idem" ON "booking_session_commits" USING btree ("session_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX "idx_booking_session_commits_booking" ON "booking_session_commits" USING btree ("booking_id");

CREATE UNLOGGED TABLE "fixed_window_rate_limits" (
	"key" text NOT NULL,
	"window" bigint NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fixed_window_rate_limits_key_window_pk" PRIMARY KEY("key","window")
);
--> statement-breakpoint
ALTER TABLE "fixed_window_rate_limits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNLOGGED TABLE "kv_store" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kv_store" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "fixed_window_rate_limits_expires_at_idx" ON "fixed_window_rate_limits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "kv_store_expires_at_idx" ON "kv_store" USING btree ("expires_at");

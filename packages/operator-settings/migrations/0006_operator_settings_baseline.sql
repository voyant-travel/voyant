CREATE TABLE "payment_provider_config" (
	"id" text PRIMARY KEY NOT NULL,
	"active_provider_id" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"mode" text,
	"connection_ref" text,
	"last_health_at" timestamp with time zone,
	"last_error" text,
	"configured_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

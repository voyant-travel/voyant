CREATE TABLE "app_session_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"app_id" text NOT NULL,
	"deployment_id" text NOT NULL,
	"jti" text NOT NULL,
	"viewer_id" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"slot" text,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_actor_id" text
);--> statement-breakpoint
ALTER TABLE "app_session_tokens" ADD CONSTRAINT "app_session_tokens_installation_id_app_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."app_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_app_session_tokens_jti" ON "app_session_tokens" USING btree ("jti");--> statement-breakpoint
CREATE INDEX "idx_app_session_tokens_installation" ON "app_session_tokens" USING btree ("installation_id","expires_at");

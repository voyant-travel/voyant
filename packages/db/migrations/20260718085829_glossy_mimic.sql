CREATE TABLE "customer_auth"."profile" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text,
	"last_name" text,
	"avatar_url" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"timezone" text,
	"ui_prefs" jsonb DEFAULT '{}'::jsonb,
	"seating_preference" "seating_preference",
	"notification_defaults" jsonb DEFAULT '{}'::jsonb,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"marketing_consent_at" timestamp with time zone,
	"marketing_consent_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_auth"."profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ADD COLUMN "phone_number_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_auth"."profile" ADD CONSTRAINT "profile_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "customer_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_auth_profile_name_idx" ON "customer_auth"."profile" USING btree ("first_name","last_name");
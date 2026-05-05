CREATE TYPE "public"."tax_policy_side" AS ENUM('sell', 'buy');--> statement-breakpoint
CREATE TABLE "tax_policy_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"jurisdiction" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_policy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"side" "tax_policy_side" DEFAULT 'sell' NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"name" text NOT NULL,
	"applies_to" "tax_class_applies_to" DEFAULT 'all' NOT NULL,
	"condition" jsonb,
	"tax_regime_id" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "operator_settings" ADD COLUMN "tax_policy_profile_id" text;--> statement-breakpoint
CREATE INDEX "idx_tax_policy_profiles_code" ON "tax_policy_profiles" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_profiles_active" ON "tax_policy_profiles" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_profile" ON "tax_policy_rules" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_profile_side_priority" ON "tax_policy_rules" USING btree ("profile_id","side","priority");--> statement-breakpoint
CREATE INDEX "idx_tax_policy_rules_active" ON "tax_policy_rules" USING btree ("active");

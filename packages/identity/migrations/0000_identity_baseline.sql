DO $$ BEGIN
 CREATE TYPE "public"."address_label" AS ENUM('primary', 'billing', 'shipping', 'mailing', 'meeting', 'service', 'legal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."contact_point_kind" AS ENUM('email', 'phone', 'mobile', 'whatsapp', 'website', 'sms', 'fax', 'social', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."named_contact_role" AS ENUM('general', 'primary', 'reservations', 'operations', 'front_desk', 'sales', 'emergency', 'accounting', 'legal', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "identity_addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"label" "address_label" DEFAULT 'other' NOT NULL,
	"full_text" text,
	"line_1" text,
	"line_2" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country" text,
	"latitude" double precision,
	"longitude" double precision,
	"timezone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_contact_points" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"kind" "contact_point_kind" NOT NULL,
	"label" text,
	"value" text NOT NULL,
	"normalized_value" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_named_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"role" "named_contact_role" DEFAULT 'general' NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"email" text,
	"phone" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_identity_addresses_entity" ON "identity_addresses" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_identity_addresses_entity_primary_created" ON "identity_addresses" USING btree ("entity_type","entity_id","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_addresses_label" ON "identity_addresses" USING btree ("label");--> statement-breakpoint
CREATE INDEX "idx_identity_contact_points_entity" ON "identity_contact_points" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_identity_contact_points_entity_primary_created" ON "identity_contact_points" USING btree ("entity_type","entity_id","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_contact_points_entity_kind_primary_created" ON "identity_contact_points" USING btree ("entity_type","entity_id","kind","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_contact_points_kind" ON "identity_contact_points" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_identity_contact_points_normalized" ON "identity_contact_points" USING btree ("normalized_value");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_identity_contact_points_entity_kind_value" ON "identity_contact_points" USING btree ("entity_type","entity_id","kind","value");--> statement-breakpoint
CREATE INDEX "idx_identity_named_contacts_entity" ON "identity_named_contacts" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_identity_named_contacts_entity_primary_created" ON "identity_named_contacts" USING btree ("entity_type","entity_id","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_named_contacts_entity_role_primary_created" ON "identity_named_contacts" USING btree ("entity_type","entity_id","role","is_primary","created_at");--> statement-breakpoint
CREATE INDEX "idx_identity_named_contacts_role" ON "identity_named_contacts" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_identity_named_contacts_primary" ON "identity_named_contacts" USING btree ("is_primary");
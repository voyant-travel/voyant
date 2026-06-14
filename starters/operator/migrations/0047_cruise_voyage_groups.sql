CREATE TYPE "public"."cruise_voyage_group_kind" AS ENUM('combination', 'grand_voyage', 'world_cruise', 'cruise_tour');--> statement-breakpoint
CREATE TYPE "public"."cruise_voyage_segment_kind" AS ENUM('cruise', 'land', 'hotel', 'transfer', 'rail', 'air', 'other');--> statement-breakpoint
CREATE TYPE "public"."cruise_voyage_segment_role" AS ENUM('core', 'pre_extension', 'post_extension');--> statement-breakpoint
CREATE TABLE "cruise_voyage_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"group_kind" "cruise_voyage_group_kind" NOT NULL,
	"line_supplier_id" text,
	"nights" integer NOT NULL,
	"embark_port_facility_id" text,
	"disembark_port_facility_id" text,
	"description" text,
	"short_description" text,
	"highlights" jsonb DEFAULT '[]'::jsonb,
	"regions" jsonb DEFAULT '[]'::jsonb,
	"themes" jsonb DEFAULT '[]'::jsonb,
	"hero_image_url" text,
	"map_image_url" text,
	"status" "cruise_status" DEFAULT 'draft' NOT NULL,
	"lowest_price_cached" numeric(12, 2),
	"lowest_price_currency_cached" text,
	"earliest_departure_cached" date,
	"latest_departure_cached" date,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cruise_voyage_group_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"voyage_group_id" text NOT NULL,
	"sort_order" integer NOT NULL,
	"segment_kind" "cruise_voyage_segment_kind" NOT NULL,
	"segment_role" "cruise_voyage_segment_role" DEFAULT 'core' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"cruise_id" text,
	"sailing_id" text,
	"start_day" integer,
	"end_day" integer,
	"start_date" date,
	"end_date" date,
	"embark_port_facility_id" text,
	"disembark_port_facility_id" text,
	"nights" integer,
	"external_refs" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_voyage_group_id_cruise_voyage_groups_id_fk" FOREIGN KEY ("voyage_group_id") REFERENCES "public"."cruise_voyage_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_cruise_id_cruises_id_fk" FOREIGN KEY ("cruise_id") REFERENCES "public"."cruises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cruise_voyage_group_segments" ADD CONSTRAINT "cruise_voyage_group_segments_sailing_id_cruise_sailings_id_fk" FOREIGN KEY ("sailing_id") REFERENCES "public"."cruise_sailings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_voyage_groups_slug" ON "cruise_voyage_groups" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_kind_status" ON "cruise_voyage_groups" USING btree ("group_kind","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_supplier_status" ON "cruise_voyage_groups" USING btree ("line_supplier_id","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_earliest_status" ON "cruise_voyage_groups" USING btree ("earliest_departure_cached","status");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_groups_status_created" ON "cruise_voyage_groups" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_cruise_voyage_segments_group_sort" ON "cruise_voyage_group_segments" USING btree ("voyage_group_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_group_role" ON "cruise_voyage_group_segments" USING btree ("voyage_group_id","segment_role");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_cruise" ON "cruise_voyage_group_segments" USING btree ("cruise_id");--> statement-breakpoint
CREATE INDEX "idx_cruise_voyage_segments_sailing" ON "cruise_voyage_group_segments" USING btree ("sailing_id");

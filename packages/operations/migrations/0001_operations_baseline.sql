DO $$ BEGIN
 CREATE TYPE "public"."function_space_layout" AS ENUM('theater', 'classroom', 'banquet', 'cabaret', 'boardroom', 'u_shape', 'reception', 'hollow_square');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "function_space_capacities" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"layout" "function_space_layout" NOT NULL,
	"capacity" integer NOT NULL,
	CONSTRAINT "ck_function_space_capacities_nonneg" CHECK (capacity >= 0)
);
--> statement-breakpoint
CREATE TABLE "function_spaces" (
	"id" text PRIMARY KEY NOT NULL,
	"facility_id" text NOT NULL,
	"parent_space_id" text,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"area_sqm" double precision,
	"divisible" boolean DEFAULT false NOT NULL,
	"default_layout" "function_space_layout",
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "function_space_capacities" ADD CONSTRAINT "function_space_capacities_space_id_function_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."function_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function_spaces" ADD CONSTRAINT "function_spaces_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "function_spaces" ADD CONSTRAINT "function_spaces_parent_space_id_function_spaces_id_fk" FOREIGN KEY ("parent_space_id") REFERENCES "public"."function_spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_function_space_capacities_space_layout" ON "function_space_capacities" USING btree ("space_id","layout");--> statement-breakpoint
CREATE INDEX "idx_function_spaces_facility_sort_name" ON "function_spaces" USING btree ("facility_id","sort_order","name");--> statement-breakpoint
CREATE INDEX "idx_function_spaces_parent" ON "function_spaces" USING btree ("parent_space_id");--> statement-breakpoint
CREATE INDEX "idx_function_spaces_active_sort_name" ON "function_spaces" USING btree ("active","sort_order","name");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_function_spaces_facility_code" ON "function_spaces" USING btree ("facility_id","code");
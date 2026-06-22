DO $$ BEGIN
 CREATE TYPE "public"."space_block_pickup_status" AS ENUM('active', 'reversed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."space_block_status" AS ENUM('inquiry', 'held', 'confirmed', 'released', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "space_block_pickups" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"booking_id" text,
	"session_id" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"units" integer DEFAULT 1 NOT NULL,
	"status" "space_block_pickup_status" DEFAULT 'active' NOT NULL,
	"picked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "ck_space_block_pickups_units_positive" CHECK (units > 0)
);
--> statement-breakpoint
CREATE TABLE "space_block_slots" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"date" date NOT NULL,
	"units_held" integer DEFAULT 0 NOT NULL,
	"units_picked_up" integer DEFAULT 0 NOT NULL,
	"units_released" integer DEFAULT 0 NOT NULL,
	"net_rate_cents_override" integer,
	"sell_rate_cents_override" integer,
	CONSTRAINT "ck_space_block_slots_nonneg" CHECK (units_held >= 0 AND units_picked_up >= 0 AND units_released >= 0),
	CONSTRAINT "ck_space_block_slots_capacity" CHECK (units_picked_up + units_released <= units_held)
);
--> statement-breakpoint
CREATE TABLE "space_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"function_space_id" text NOT NULL,
	"program_id" text,
	"supplier_id" text,
	"name" text NOT NULL,
	"status" "space_block_status" DEFAULT 'inquiry' NOT NULL,
	"currency" text,
	"net_rate_cents" integer,
	"sell_rate_cents" integer,
	"hold_start_time" text,
	"hold_end_time" text,
	"option_date" date,
	"cutoff_date" date,
	"attrition_terms" jsonb,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "space_block_pickups" ADD CONSTRAINT "space_block_pickups_block_id_space_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."space_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_block_slots" ADD CONSTRAINT "space_block_slots_block_id_space_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."space_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_blocks" ADD CONSTRAINT "space_blocks_function_space_id_function_spaces_id_fk" FOREIGN KEY ("function_space_id") REFERENCES "public"."function_spaces"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_space_block_pickups_block" ON "space_block_pickups" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "idx_space_block_pickups_booking" ON "space_block_pickups" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_space_block_pickups_session" ON "space_block_pickups" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_space_block_pickups_session" ON "space_block_pickups" USING btree ("session_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_space_block_slots_block_date" ON "space_block_slots" USING btree ("block_id","date");--> statement-breakpoint
CREATE INDEX "idx_space_blocks_function_space" ON "space_blocks" USING btree ("function_space_id");--> statement-breakpoint
CREATE INDEX "idx_space_blocks_program" ON "space_blocks" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_space_blocks_supplier" ON "space_blocks" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_space_blocks_status" ON "space_blocks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_space_blocks_cutoff" ON "space_blocks" USING btree ("cutoff_date");
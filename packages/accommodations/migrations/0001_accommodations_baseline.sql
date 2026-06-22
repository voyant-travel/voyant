DO $$ BEGIN
 CREATE TYPE "public"."room_block_pickup_status" AS ENUM('active', 'reversed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."hotel_room_block_status" AS ENUM('inquiry', 'held', 'confirmed', 'released', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "room_block_nights" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"date" date NOT NULL,
	"rooms_held" integer DEFAULT 0 NOT NULL,
	"rooms_picked_up" integer DEFAULT 0 NOT NULL,
	"rooms_released" integer DEFAULT 0 NOT NULL,
	"net_rate_cents_override" integer,
	"sell_rate_cents_override" integer,
	CONSTRAINT "ck_room_block_nights_nonneg" CHECK (rooms_held >= 0 AND rooms_picked_up >= 0 AND rooms_released >= 0),
	CONSTRAINT "ck_room_block_nights_capacity" CHECK (rooms_picked_up + rooms_released <= rooms_held)
);
--> statement-breakpoint
CREATE TABLE "room_block_pickups" (
	"id" text PRIMARY KEY NOT NULL,
	"block_id" text NOT NULL,
	"booking_id" text,
	"stay_booking_item_id" text,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"rooms" integer DEFAULT 1 NOT NULL,
	"status" "room_block_pickup_status" DEFAULT 'active' NOT NULL,
	"picked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reversed_at" timestamp with time zone,
	CONSTRAINT "ck_room_block_pickups_rooms_positive" CHECK (rooms > 0)
);
--> statement-breakpoint
CREATE TABLE "room_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text,
	"supplier_id" text,
	"property_id" text,
	"room_type_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "hotel_room_block_status" DEFAULT 'inquiry' NOT NULL,
	"currency" text NOT NULL,
	"net_rate_cents" integer,
	"sell_rate_cents" integer,
	"option_date" date,
	"cutoff_date" date,
	"attrition_terms" jsonb,
	"deposit_terms" jsonb,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_block_nights" ADD CONSTRAINT "room_block_nights_block_id_room_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."room_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block_pickups" ADD CONSTRAINT "room_block_pickups_block_id_room_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."room_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_block_pickups" ADD CONSTRAINT "room_block_pickups_stay_booking_item_id_stay_booking_items_id_fk" FOREIGN KEY ("stay_booking_item_id") REFERENCES "public"."stay_booking_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_blocks" ADD CONSTRAINT "room_blocks_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_room_block_nights_block_date" ON "room_block_nights" USING btree ("block_id","date");--> statement-breakpoint
CREATE INDEX "idx_room_block_pickups_block" ON "room_block_pickups" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "idx_room_block_pickups_booking" ON "room_block_pickups" USING btree ("booking_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_room_block_pickups_stay_item" ON "room_block_pickups" USING btree ("stay_booking_item_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_room_blocks_program" ON "room_blocks" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_supplier" ON "room_blocks" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_property" ON "room_blocks" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_room_type" ON "room_blocks" USING btree ("room_type_id");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_status" ON "room_blocks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_room_blocks_cutoff" ON "room_blocks" USING btree ("cutoff_date");
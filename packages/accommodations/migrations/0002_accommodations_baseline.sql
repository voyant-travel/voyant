CREATE TABLE "rate_plan_daily_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"rate_plan_id" text NOT NULL,
	"room_type_id" text NOT NULL,
	"date" date NOT NULL,
	"sell_currency" text NOT NULL,
	"sell_amount_cents" integer NOT NULL,
	"cost_currency" text,
	"cost_amount_cents" integer,
	"tax_amount_cents" integer,
	"fee_amount_cents" integer,
	"occupancy_basis" text DEFAULT 'room' NOT NULL,
	"included_adults" integer DEFAULT 2 NOT NULL,
	"included_children" integer DEFAULT 0 NOT NULL,
	"included_infants" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_type_daily_inventory" (
	"id" text PRIMARY KEY NOT NULL,
	"room_type_id" text NOT NULL,
	"date" date NOT NULL,
	"capacity" integer DEFAULT 0 NOT NULL,
	"closed" boolean DEFAULT false NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rate_plan_daily_rates" ADD CONSTRAINT "rate_plan_daily_rates_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plan_daily_rates" ADD CONSTRAINT "rate_plan_daily_rates_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_type_daily_inventory" ADD CONSTRAINT "room_type_daily_inventory_room_type_id_room_types_id_fk" FOREIGN KEY ("room_type_id") REFERENCES "public"."room_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_rate_plan_daily_rates_date" ON "rate_plan_daily_rates" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_daily_rates_room_date" ON "rate_plan_daily_rates" USING btree ("room_type_id","date");--> statement-breakpoint
CREATE INDEX "idx_rate_plan_daily_rates_rate_plan_date" ON "rate_plan_daily_rates" USING btree ("rate_plan_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_rate_plan_daily_rates_plan_room_date" ON "rate_plan_daily_rates" USING btree ("rate_plan_id","room_type_id","date");--> statement-breakpoint
CREATE INDEX "idx_room_type_daily_inventory_date" ON "room_type_daily_inventory" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_room_type_daily_inventory_room_date" ON "room_type_daily_inventory" USING btree ("room_type_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_room_type_daily_inventory_room_date" ON "room_type_daily_inventory" USING btree ("room_type_id","date");
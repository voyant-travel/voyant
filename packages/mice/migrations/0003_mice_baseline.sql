DO $$ BEGIN
 CREATE TYPE "public"."mice_bid_status" AS ENUM('draft', 'submitted', 'under_review', 'accepted', 'rejected');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_rfp_invitation_status" AS ENUM('invited', 'viewed', 'declined', 'responded');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_rfp_status" AS ENUM('draft', 'issued', 'closed', 'awarded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "mice_bid_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"bid_id" text NOT NULL,
	"criterion" text NOT NULL,
	"weight" integer,
	"score" integer,
	"notes" text,
	"evaluated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_bid_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"bid_id" text NOT NULL,
	"requirement_ref" text,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_cents" integer,
	"total_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_bids" (
	"id" text PRIMARY KEY NOT NULL,
	"rfp_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"status" "mice_bid_status" DEFAULT 'draft' NOT NULL,
	"total_cents" integer,
	"currency" text,
	"proposal_doc" text,
	"valid_until" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_rfp_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"rfp_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"status" "mice_rfp_invitation_status" DEFAULT 'invited' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_rfps" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"title" text NOT NULL,
	"requirements" jsonb,
	"status" "mice_rfp_status" DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mice_bid_evaluations" ADD CONSTRAINT "mice_bid_evaluations_bid_id_mice_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."mice_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_bid_lines" ADD CONSTRAINT "mice_bid_lines_bid_id_mice_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."mice_bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_bids" ADD CONSTRAINT "mice_bids_rfp_id_mice_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."mice_rfps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_rfp_invitations" ADD CONSTRAINT "mice_rfp_invitations_rfp_id_mice_rfps_id_fk" FOREIGN KEY ("rfp_id") REFERENCES "public"."mice_rfps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_rfps" ADD CONSTRAINT "mice_rfps_program_id_mice_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mice_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mice_bid_evaluations_bid" ON "mice_bid_evaluations" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_mice_bid_lines_bid" ON "mice_bid_lines" USING btree ("bid_id");--> statement-breakpoint
CREATE INDEX "idx_mice_bids_rfp" ON "mice_bids" USING btree ("rfp_id");--> statement-breakpoint
CREATE INDEX "idx_mice_bids_supplier" ON "mice_bids" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "idx_mice_bids_status" ON "mice_bids" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_mice_rfp_invitations_supplier" ON "mice_rfp_invitations" USING btree ("supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_mice_rfp_invitations_rfp_supplier" ON "mice_rfp_invitations" USING btree ("rfp_id","supplier_id");--> statement-breakpoint
CREATE INDEX "idx_mice_rfps_program" ON "mice_rfps" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_mice_rfps_status" ON "mice_rfps" USING btree ("status");
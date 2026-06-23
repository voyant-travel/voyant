DO $$ BEGIN
 CREATE TYPE "public"."mice_delegate_role" AS ENUM('attendee', 'speaker', 'sponsor', 'vip', 'staff', 'exhibitor', 'organizer');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_delegate_status" AS ENUM('invited', 'registered', 'confirmed', 'checked_in', 'no_show', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_enrollment_status" AS ENUM('registered', 'waitlisted', 'attended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "booking_mice_details" (
	"booking_id" text PRIMARY KEY NOT NULL,
	"program_id" text,
	"delegate_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_delegate_session_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"delegate_id" text NOT NULL,
	"session_id" text NOT NULL,
	"status" "mice_enrollment_status" DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_program_delegates" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"person_id" text,
	"booking_id" text,
	"role" "mice_delegate_role" DEFAULT 'attendee' NOT NULL,
	"status" "mice_delegate_status" DEFAULT 'invited' NOT NULL,
	"arrival_at" timestamp with time zone,
	"departure_at" timestamp with time zone,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_rooming_assignment_delegates" (
	"id" text PRIMARY KEY NOT NULL,
	"rooming_assignment_id" text NOT NULL,
	"delegate_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"bed_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_rooming_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"room_block_id" text,
	"room_type_id" text,
	"bed_config" text,
	"sharing_group_id" text,
	"check_in" date,
	"check_out" date,
	"special_requests" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mice_delegate_session_enrollments" ADD CONSTRAINT "mice_delegate_session_enrollments_delegate_id_mice_program_delegates_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "public"."mice_program_delegates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_delegate_session_enrollments" ADD CONSTRAINT "mice_delegate_session_enrollments_session_id_mice_program_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mice_program_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_program_delegates" ADD CONSTRAINT "mice_program_delegates_program_id_mice_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mice_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_rooming_assignment_delegates" ADD CONSTRAINT "mice_rooming_assignment_delegates_rooming_assignment_id_mice_rooming_assignments_id_fk" FOREIGN KEY ("rooming_assignment_id") REFERENCES "public"."mice_rooming_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_rooming_assignment_delegates" ADD CONSTRAINT "mice_rooming_assignment_delegates_delegate_id_mice_program_delegates_id_fk" FOREIGN KEY ("delegate_id") REFERENCES "public"."mice_program_delegates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_rooming_assignments" ADD CONSTRAINT "mice_rooming_assignments_program_id_mice_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mice_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bkmd_program" ON "booking_mice_details" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_bkmd_delegate" ON "booking_mice_details" USING btree ("delegate_id");--> statement-breakpoint
CREATE INDEX "idx_mice_enrollments_session" ON "mice_delegate_session_enrollments" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_mice_enrollments_delegate_session" ON "mice_delegate_session_enrollments" USING btree ("delegate_id","session_id");--> statement-breakpoint
CREATE INDEX "idx_mice_program_delegates_program" ON "mice_program_delegates" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_mice_program_delegates_program_status" ON "mice_program_delegates" USING btree ("program_id","status");--> statement-breakpoint
CREATE INDEX "idx_mice_program_delegates_person" ON "mice_program_delegates" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "idx_mice_program_delegates_booking" ON "mice_program_delegates" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_mice_rooming_assignment_delegates_assignment" ON "mice_rooming_assignment_delegates" USING btree ("rooming_assignment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_mice_rooming_assignment_delegates_pair" ON "mice_rooming_assignment_delegates" USING btree ("rooming_assignment_id","delegate_id");--> statement-breakpoint
CREATE INDEX "idx_mice_rooming_assignments_program" ON "mice_rooming_assignments" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_mice_rooming_assignments_room_block" ON "mice_rooming_assignments" USING btree ("room_block_id");
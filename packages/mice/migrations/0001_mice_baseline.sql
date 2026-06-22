DO $$ BEGIN
 CREATE TYPE "public"."mice_session_inclusion_kind" AS ENUM('fnb', 'av', 'materials', 'signage', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."mice_session_type" AS ENUM('keynote', 'breakout', 'meal', 'networking', 'gala', 'excursion', 'free');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE "mice_program_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"program_id" text NOT NULL,
	"function_space_id" text,
	"title" text NOT NULL,
	"session_type" "mice_session_type" DEFAULT 'breakout' NOT NULL,
	"day_date" date,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"track" text,
	"capacity" integer,
	"requires_registration" boolean DEFAULT false NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mice_session_inclusions" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"kind" "mice_session_inclusion_kind" NOT NULL,
	"description" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"cost_amount_cents" integer,
	"currency" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mice_program_sessions" ADD CONSTRAINT "mice_program_sessions_program_id_mice_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."mice_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mice_session_inclusions" ADD CONSTRAINT "mice_session_inclusions_session_id_mice_program_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."mice_program_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mice_program_sessions_program" ON "mice_program_sessions" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "idx_mice_program_sessions_program_day" ON "mice_program_sessions" USING btree ("program_id","day_date");--> statement-breakpoint
CREATE INDEX "idx_mice_program_sessions_function_space" ON "mice_program_sessions" USING btree ("function_space_id");--> statement-breakpoint
CREATE INDEX "idx_mice_program_sessions_starts_at" ON "mice_program_sessions" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_mice_session_inclusions_session" ON "mice_session_inclusions" USING btree ("session_id");
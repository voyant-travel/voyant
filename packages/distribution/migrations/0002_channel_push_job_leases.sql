CREATE TABLE IF NOT EXISTS "channel_push_job_leases" (
  "job_id" text PRIMARY KEY NOT NULL,
  "owner" text NOT NULL,
  "lease_until" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

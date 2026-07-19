CREATE TABLE "customer_auth"."business_account_request" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_user_id" text NOT NULL,
	"storefront_origin" text NOT NULL,
	"mode" text NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"website" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"idempotency_key" text NOT NULL,
	"auth_organization_id" text,
	"relationship_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_at" timestamp with time zone,
	"decided_by" text,
	"decision_reason" text,
	CONSTRAINT "customer_auth_business_request_mode_check" CHECK ("customer_auth"."business_account_request"."mode" IN ('open', 'request', 'invite-only')),
	CONSTRAINT "customer_auth_business_request_status_check" CHECK ("customer_auth"."business_account_request"."status" IN ('pending', 'approved', 'rejected', 'canceled'))
);
--> statement-breakpoint
UPDATE "customer_auth"."invitation"
SET "role" = 'member'
WHERE "role" IS NULL OR "role" NOT IN ('owner', 'admin', 'member');--> statement-breakpoint
WITH ranked_pending AS (
	SELECT "id", row_number() OVER (
		PARTITION BY lower("email"), "organization_id"
		ORDER BY "created_at" DESC, "id" DESC
	) AS rank
	FROM "customer_auth"."invitation"
	WHERE "status" = 'pending'
)
UPDATE "customer_auth"."invitation" AS invitation
SET "status" = 'canceled'
FROM ranked_pending
WHERE invitation."id" = ranked_pending."id" AND ranked_pending.rank > 1;--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ALTER COLUMN "role" SET DEFAULT 'member';--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_auth"."business_account_request" ADD CONSTRAINT "business_account_request_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "customer_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth"."business_account_request" ADD CONSTRAINT "business_account_request_auth_organization_id_organization_id_fk" FOREIGN KEY ("auth_organization_id") REFERENCES "customer_auth"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_auth_business_request_requester_idx" ON "customer_auth"."business_account_request" USING btree ("requester_user_id");--> statement-breakpoint
CREATE INDEX "customer_auth_business_request_status_idx" ON "customer_auth"."business_account_request" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_business_request_requester_idempotency_unique" ON "customer_auth"."business_account_request" USING btree ("requester_user_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_business_request_pending_requester_unique" ON "customer_auth"."business_account_request" USING btree ("requester_user_id") WHERE "customer_auth"."business_account_request"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_invitation_pending_email_organization_unique" ON "customer_auth"."invitation" USING btree (lower("email"),"organization_id") WHERE "customer_auth"."invitation"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ADD CONSTRAINT "customer_auth_invitation_role_check" CHECK ("customer_auth"."invitation"."role" IN ('owner', 'admin', 'member'));--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ADD CONSTRAINT "customer_auth_invitation_status_check" CHECK ("customer_auth"."invitation"."status" IN ('pending', 'accepted', 'rejected', 'canceled'));

CREATE TABLE "customer_auth"."invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth"."member" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth"."organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"relationship_organization_id" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_auth"."personal_buyer_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "customer_auth"."session" ADD COLUMN "active_organization_id" text;--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ADD COLUMN "personal_buyer_entitlement_eligible" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ADD COLUMN "relationship_person_id" text;--> statement-breakpoint
UPDATE "customer_auth"."user" SET "personal_buyer_entitlement_eligible" = true;--> statement-breakpoint
INSERT INTO "customer_auth"."personal_buyer_account" ("user_id", "created_at", "updated_at")
SELECT "id", now(), now() FROM "customer_auth"."user"
ON CONFLICT ("user_id") DO NOTHING;--> statement-breakpoint
DO $$
BEGIN
	IF to_regclass('public.people') IS NOT NULL THEN
		IF EXISTS (
			SELECT 1
			FROM "people"
			WHERE "source" = 'customer_auth.user' AND "source_ref" IS NOT NULL
			GROUP BY "source_ref"
			HAVING count(*) > 1
		) THEN
			RAISE EXCEPTION 'Cannot backfill customer identity Person links: duplicate customer_auth.user source_ref';
		END IF;

		UPDATE "customer_auth"."user" AS customer_user
		SET "relationship_person_id" = person."id", "updated_at" = now()
		FROM "people" AS person
		WHERE person."source" = 'customer_auth.user'
			AND person."source_ref" = customer_user."id"
			AND customer_user."relationship_person_id" IS NULL;
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "customer_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth"."invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "customer_auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth"."member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "customer_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth"."member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "customer_auth"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_auth"."personal_buyer_account" ADD CONSTRAINT "personal_buyer_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "customer_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_auth_invitation_email_idx" ON "customer_auth"."invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_auth_invitation_organization_idx" ON "customer_auth"."invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customer_auth_member_user_idx" ON "customer_auth"."member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customer_auth_member_organization_idx" ON "customer_auth"."member" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_member_user_organization_unique" ON "customer_auth"."member" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_organization_slug_unique" ON "customer_auth"."organization" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_organization_relationship_unique" ON "customer_auth"."organization" USING btree ("relationship_organization_id") WHERE "customer_auth"."organization"."relationship_organization_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_auth_personal_buyer_revoked_idx" ON "customer_auth"."personal_buyer_account" USING btree ("revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_user_relationship_person_unique" ON "customer_auth"."user" USING btree ("relationship_person_id") WHERE "customer_auth"."user"."relationship_person_id" IS NOT NULL;

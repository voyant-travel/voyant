DROP INDEX "customer_auth"."customer_auth_user_email_unique";--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_user_phone_unique" ON "customer_auth"."user" USING btree ("phone_number") WHERE "customer_auth"."user"."phone_number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_auth_user_email_unique" ON "customer_auth"."user" USING btree ("email") WHERE "customer_auth"."user"."email" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_auth"."user" ADD CONSTRAINT "customer_auth_user_email_or_phone" CHECK ("customer_auth"."user"."email" IS NOT NULL OR "customer_auth"."user"."phone_number" IS NOT NULL);
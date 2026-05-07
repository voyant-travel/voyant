ALTER TABLE "user" DROP CONSTRAINT "user_email_unique";
--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique"
  ON "user" USING btree ("email")
  WHERE "email" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_unique"
  ON "user" USING btree ("phone_number")
  WHERE "phone_number" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_or_phone"
  CHECK ("email" IS NOT NULL OR "phone_number" IS NOT NULL);

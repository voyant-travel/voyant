ALTER TYPE "public"."voucher_source_type" RENAME TO "travel_credit_source_type";--> statement-breakpoint
ALTER TYPE "public"."voucher_status" RENAME TO "travel_credit_status";--> statement-breakpoint
ALTER TABLE "voucher_redemptions" RENAME TO "travel_credit_redemptions";--> statement-breakpoint
ALTER TABLE "vouchers" RENAME TO "travel_credits";--> statement-breakpoint
ALTER TABLE "travel_credit_redemptions" RENAME COLUMN "voucher_id" TO "travel_credit_id";--> statement-breakpoint
ALTER TABLE "travel_credit_redemptions" DROP CONSTRAINT "voucher_redemptions_voucher_id_vouchers_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_instruments" ALTER COLUMN "instrument_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "payment_instruments" SET "instrument_type" = 'travel_credit' WHERE "instrument_type" = 'voucher';--> statement-breakpoint
DROP TYPE "public"."payment_instrument_type";--> statement-breakpoint
CREATE TYPE "public"."payment_instrument_type" AS ENUM('credit_card', 'debit_card', 'bank_account', 'wallet', 'travel_credit', 'direct_bill', 'cash', 'other');--> statement-breakpoint
ALTER TABLE "payment_instruments" ALTER COLUMN "instrument_type" SET DATA TYPE "public"."payment_instrument_type" USING "instrument_type"::"public"."payment_instrument_type";--> statement-breakpoint
ALTER TABLE "payment_sessions" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "supplier_payments" ALTER COLUMN "payment_method" SET DATA TYPE text;--> statement-breakpoint
UPDATE "payment_sessions" SET "payment_method" = 'travel_credit' WHERE "payment_method" = 'voucher';--> statement-breakpoint
UPDATE "payments" SET "payment_method" = 'travel_credit' WHERE "payment_method" = 'voucher';--> statement-breakpoint
UPDATE "supplier_payments" SET "payment_method" = 'travel_credit' WHERE "payment_method" = 'voucher';--> statement-breakpoint
DROP TYPE "public"."payment_method";--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('bank_transfer', 'credit_card', 'debit_card', 'cash', 'cheque', 'wallet', 'direct_bill', 'travel_credit', 'other');--> statement-breakpoint
ALTER TABLE "payment_sessions" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "supplier_payments" ALTER COLUMN "payment_method" SET DATA TYPE "public"."payment_method" USING "payment_method"::"public"."payment_method";--> statement-breakpoint
ALTER TABLE "travel_credits" ALTER COLUMN "source_type" SET DATA TYPE text;--> statement-breakpoint
UPDATE "travel_credits" SET "source_type" = 'promotion' WHERE "source_type" = 'promo';--> statement-breakpoint
DROP TYPE "public"."travel_credit_source_type";--> statement-breakpoint
CREATE TYPE "public"."travel_credit_source_type" AS ENUM('refund', 'cancellation_credit', 'gift', 'manual', 'goodwill', 'promotion');--> statement-breakpoint
ALTER TABLE "travel_credits" ALTER COLUMN "source_type" SET DATA TYPE "public"."travel_credit_source_type" USING "source_type"::"public"."travel_credit_source_type";--> statement-breakpoint
DROP INDEX "idx_voucher_redemptions_voucher";--> statement-breakpoint
DROP INDEX "idx_voucher_redemptions_booking";--> statement-breakpoint
DROP INDEX "idx_voucher_redemptions_voucher_created";--> statement-breakpoint
DROP INDEX "uidx_vouchers_code";--> statement-breakpoint
DROP INDEX "idx_vouchers_series";--> statement-breakpoint
DROP INDEX "idx_vouchers_status";--> statement-breakpoint
DROP INDEX "idx_vouchers_person";--> statement-breakpoint
DROP INDEX "idx_vouchers_organization";--> statement-breakpoint
DROP INDEX "idx_vouchers_source_booking";--> statement-breakpoint
DROP INDEX "idx_vouchers_valid_from";--> statement-breakpoint
DROP INDEX "idx_vouchers_expires_at";--> statement-breakpoint
DROP INDEX "idx_vouchers_remaining";--> statement-breakpoint
ALTER TABLE "travel_credit_redemptions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "travel_credit_redemptions" ADD CONSTRAINT "travel_credit_redemptions_travel_credit_id_travel_credits_id_fk" FOREIGN KEY ("travel_credit_id") REFERENCES "public"."travel_credits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_travel_credit_redemptions_credit" ON "travel_credit_redemptions" USING btree ("travel_credit_id");--> statement-breakpoint
CREATE INDEX "idx_travel_credit_redemptions_booking" ON "travel_credit_redemptions" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_travel_credit_redemptions_credit_created" ON "travel_credit_redemptions" USING btree ("travel_credit_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_travel_credit_redemptions_idempotency" ON "travel_credit_redemptions" USING btree ("travel_credit_id","idempotency_key");--> statement-breakpoint
UPDATE "travel_credits" SET "code" = upper(trim("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "uidx_travel_credits_code" ON "travel_credits" USING btree (lower("code"));--> statement-breakpoint
CREATE INDEX "idx_travel_credits_series" ON "travel_credits" USING btree ("series_code");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_status" ON "travel_credits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_person" ON "travel_credits" USING btree ("issued_to_person_id");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_organization" ON "travel_credits" USING btree ("issued_to_organization_id");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_source_booking" ON "travel_credits" USING btree ("source_booking_id");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_valid_from" ON "travel_credits" USING btree ("valid_from");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_expires_at" ON "travel_credits" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_travel_credits_remaining" ON "travel_credits" USING btree ("remaining_amount_cents");

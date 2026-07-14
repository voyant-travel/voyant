ALTER TABLE "product_ticket_settings" RENAME COLUMN "voucher_message" TO "service_voucher_message";--> statement-breakpoint
ALTER TYPE "public"."product_capability" RENAME VALUE 'voucher_required' TO 'service_voucher_required';--> statement-breakpoint
ALTER TYPE "public"."product_delivery_format" RENAME VALUE 'voucher' TO 'service_voucher';

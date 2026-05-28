ALTER TABLE "bookings" ADD COLUMN "contact_party_type" text;
ALTER TABLE "bookings" ADD COLUMN "contact_tax_id" text;
ALTER TABLE "offers" ADD COLUMN "contact_party_type" text;
ALTER TABLE "offers" ADD COLUMN "contact_tax_id" text;
ALTER TABLE "orders" ADD COLUMN "contact_party_type" text;
ALTER TABLE "orders" ADD COLUMN "contact_tax_id" text;

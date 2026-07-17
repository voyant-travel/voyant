-- Scope `invoicing_mode` to the deferred bank-transfer payment path and make
-- `proforma-first` the default. `proforma-first` is the platform's historical
-- bank-transfer behaviour (a proforma is issued at order placement and the
-- fiscal invoice is minted on settlement), so it is the correct default; the
-- prior `direct` default came from the setting shipping before it was scoped.
--
-- Backfilling the existing `direct` rows is safe: the setting shipped in
-- 0001 and no deployment has intentionally flipped it away from the default,
-- so any stored `direct` value is the old default rather than an operator
-- choice. Card checkouts always invoice directly regardless of this column.
ALTER TABLE "booking_tax_settings" ALTER COLUMN "invoicing_mode" SET DEFAULT 'proforma-first';
--> statement-breakpoint
UPDATE "booking_tax_settings" SET "invoicing_mode" = 'proforma-first' WHERE "invoicing_mode" = 'direct';

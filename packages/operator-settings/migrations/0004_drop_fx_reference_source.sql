-- Drop the operator-facing FX reference-source setting. The source of the
-- official reference rate is not an operator choice: Voyant Cloud serves
-- managed FX by default, self-hosters supply their own adapter through the
-- finance fx-reference port, and for jurisdictions like RO the source (BNR)
-- is legally mandated rather than a preference. The column shipped in 0002
-- and only the managed sandbox has it, so dropping it needs no back-compat
-- (pre-prod, no released dependants).
ALTER TABLE "booking_tax_settings" DROP COLUMN "fx_reference_source";

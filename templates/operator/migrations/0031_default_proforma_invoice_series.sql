WITH chosen_invoice_series AS (
  SELECT "id"
  FROM "invoice_number_series"
  WHERE "scope" = 'invoice' AND "active" = true
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1
)
UPDATE "invoice_number_series"
SET "is_default" = true, "updated_at" = now()
WHERE "id" = (SELECT "id" FROM chosen_invoice_series)
  AND NOT EXISTS (
    SELECT 1
    FROM "invoice_number_series"
    WHERE "scope" = 'invoice' AND "active" = true AND "is_default" = true
  );--> statement-breakpoint

WITH chosen_proforma_series AS (
  SELECT "id"
  FROM "invoice_number_series"
  WHERE "scope" = 'proforma' AND "active" = true
  ORDER BY "created_at" ASC, "id" ASC
  LIMIT 1
)
UPDATE "invoice_number_series"
SET "is_default" = true, "updated_at" = now()
WHERE "id" = (SELECT "id" FROM chosen_proforma_series)
  AND NOT EXISTS (
    SELECT 1
    FROM "invoice_number_series"
    WHERE "scope" = 'proforma' AND "active" = true AND "is_default" = true
  );--> statement-breakpoint

DO $$
DECLARE
  proforma_code text := 'PRO-2026';
  proforma_suffix integer := 1;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "invoice_number_series"
    WHERE "scope" = 'proforma' AND "active" = true AND "is_default" = true
  ) THEN
    WHILE EXISTS (
      SELECT 1
      FROM "invoice_number_series"
      WHERE "code" = proforma_code
    ) LOOP
      proforma_code := 'PRO-2026-' || proforma_suffix::text;
      proforma_suffix := proforma_suffix + 1;
    END LOOP;

    INSERT INTO "invoice_number_series" (
      "id",
      "code",
      "name",
      "prefix",
      "separator",
      "pad_length",
      "current_sequence",
      "reset_strategy",
      "scope",
      "is_default",
      "active",
      "created_at",
      "updated_at"
    )
    VALUES (
      'invs_00000000000000000000115000',
      proforma_code,
      'Proformas 2026',
      proforma_code || '-',
      '',
      5,
      0,
      'never',
      'proforma',
      true,
      true,
      now(),
      now()
    );
  END IF;
END $$;

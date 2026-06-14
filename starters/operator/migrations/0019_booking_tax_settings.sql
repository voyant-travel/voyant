CREATE TABLE IF NOT EXISTS "booking_tax_settings" (
  "id" text PRIMARY KEY NOT NULL,
  "tax_price_mode" text DEFAULT 'inclusive' NOT NULL,
  "tax_policy_profile_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "booking_tax_settings" (
  "id",
  "tax_price_mode",
  "tax_policy_profile_id",
  "created_at",
  "updated_at"
)
SELECT
  'btxs_00000000000000000000000000',
  COALESCE("tax_price_mode", 'inclusive'),
  "tax_policy_profile_id",
  now(),
  now()
FROM "operator_settings"
ORDER BY "created_at" DESC
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "operator_profile" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text,
  "legal_name" text,
  "vat_id" text,
  "registration_number" text,
  "address" text,
  "phone" text,
  "email" text,
  "website" text,
  "license" text,
  "license_authority" text,
  "signatory_name" text,
  "signatory_role" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operator_payment_instructions" (
  "id" text PRIMARY KEY NOT NULL,
  "bank_transfer_beneficiary" text,
  "iban" text,
  "bank" text,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "operator_payment_defaults" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_payment_policy" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "operator_profile" (
  "id",
  "name",
  "legal_name",
  "vat_id",
  "registration_number",
  "address",
  "phone",
  "email",
  "website",
  "license",
  "license_authority",
  "signatory_name",
  "signatory_role",
  "created_at",
  "updated_at"
)
SELECT
  'oppf_00000000000000000000000000',
  "name",
  "legal_name",
  "vat_id",
  "registration_number",
  "address",
  "phone",
  "email",
  "website",
  "license",
  "license_authority",
  "signatory_name",
  "signatory_role",
  now(),
  now()
FROM "operator_settings"
ORDER BY "created_at" DESC
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "operator_payment_instructions" (
  "id",
  "iban",
  "bank",
  "created_at",
  "updated_at"
)
SELECT
  'opin_00000000000000000000000000',
  "iban",
  "bank",
  now(),
  now()
FROM "operator_settings"
ORDER BY "created_at" DESC
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "operator_payment_defaults" (
  "id",
  "customer_payment_policy",
  "created_at",
  "updated_at"
)
SELECT
  'opdp_00000000000000000000000000',
  "customer_payment_policy",
  now(),
  now()
FROM "operator_settings"
ORDER BY "created_at" DESC
LIMIT 1
ON CONFLICT ("id") DO NOTHING;

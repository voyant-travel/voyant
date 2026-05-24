DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'invoice_status'
      AND e.enumlabel = 'sent'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'invoice_status'
      AND e.enumlabel = 'issued'
  ) THEN
    ALTER TYPE "public"."invoice_status" RENAME VALUE 'sent' TO 'issued';
  END IF;
END $$;

-- Indexes targeting the new stage-based reminder dispatcher's inner-loop
-- queries. Hand-crafted because drizzle-kit doesn't emit partial indexes or
-- composite indexes that span multiple columns idiomatically.
--
-- Affected queries (see packages/notifications/src/service-sequence.ts):
--   1. fetchOpenInvoiceTargets:   WHERE balance_due_cents > 0
--                                   AND invoice_type IN ('invoice','proforma')
--                                   AND status IN ('sent','partially_paid','overdue')
--   2. fetchOpenPaymentScheduleTargets:
--                                 WHERE status IN ('pending','due')
--   3. loadHistory:               WHERE reminder_rule_id = $1 AND target_id = $2
--                                  ORDER BY scheduled_for
--   4. suppressedByGroup / exceedsRecipientRateLimit:
--                                 WHERE recipient = $1 AND status = 'sent'
--                                   AND processed_at >= $since
--
-- Without these the dispatcher does sequential scans on hot tables once a
-- handful of stage-based rules go live.

CREATE INDEX IF NOT EXISTS "idx_invoices_open_due_date"
  ON "invoices" ("due_date", "status")
  WHERE "balance_due_cents" > 0
    AND "invoice_type" IN ('invoice', 'proforma')
    AND "status" IN ('sent', 'partially_paid', 'overdue');--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_booking_payment_schedules_open_due_date"
  ON "booking_payment_schedules" ("due_date", "status")
  WHERE "status" IN ('pending', 'due');--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notification_reminder_runs_rule_target_scheduled"
  ON "notification_reminder_runs" ("reminder_rule_id", "target_id", "scheduled_for");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_notification_reminder_runs_recipient_status_processed"
  ON "notification_reminder_runs" ("recipient", "status", "processed_at")
  WHERE "recipient" IS NOT NULL;

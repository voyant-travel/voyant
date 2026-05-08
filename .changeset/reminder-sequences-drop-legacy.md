---
"@voyantjs/notifications": minor
"@voyantjs/notifications-ui": minor
"@voyantjs/notifications-react": patch
"@voyantjs/ui": patch
"@voyantjs/checkout": patch
---

Drop legacy single-offset reminder path; polish channel editor (#488).

Stage channel editor:
- Replaces the two free-text "Template id / Template slug" fields with
  a single async `<TemplatePicker>` (typeahead via `AsyncCombobox`)
  filtered by the channel selected at the top of the dialog. Picking
  a template now resolves to the template id directly — no more
  guessing slugs. Switching channel clears the picked template since
  the next list will be filtered.
- Provider becomes a `<Select>` with **Automatic** / **Resend
  (email)** / **Twilio (SMS)** options. "Automatic" maps to `null`
  (use the deployment default for that channel).
- Drops the freeform "Recipient role" field. Recipient resolution is
  driven by the booking's primary contact / first traveler today;
  the role tag wasn't actually consulted by the dispatcher.

Backend cleanup (we're in beta — no users, no compat needed):
- Drops the `relative_days_from_due_date` column from
  `notification_reminder_rules` (migration
  `0003_drop_legacy_columns.sql`).
- Drops the `holiday_calendar` column from `notification_settings`
  (UI was already gone; the underlying public-holidays integration is
  out of scope for this iteration).
- Removes the legacy single-offset dispatcher path entirely:
  `queueDueReminders` and `runDueReminders` now delegate straight to
  the stage-aware versions, and the four legacy helpers
  (`queueBookingPaymentScheduleReminder`,
  `queueInvoiceReminder`, `sendBookingPaymentScheduleReminder`,
  `sendInvoiceReminder`) plus the `ruleHasStages` skip check are
  deleted. Net ~500 lines removed from `service-reminders.ts`.
- `relativeDaysFromDueDate` removed from validation, the run-summary
  schema, the notifications-react record schema, the operator
  template detail page, the legacy rule dialog, and the checkout
  service's reminder-runs join projection.
- Legacy integration tests `reminders.test.ts` and
  `reminder-tasks.test.ts` are deleted; the stage-based
  `reminder-sequences.test.ts` covers the path that survives.

---
"@voyantjs/notifications-ui": patch
"@voyantjs/ui": minor
---

Reminder sequences UI cleanup (#488):

- `NotificationSettingsForm` drops the holiday-calendar combobox section. The
  DB column stays in place (nullable) for forward-compat, but the UI no longer
  exposes it — proper holiday handling needs a real public-holidays source and
  is out of scope.
- `NotificationReminderRulesPage` gains a per-row **Manage stages** link that
  points at `/notifications/reminder-rules/<id>` and accepts a
  `manageStagesHref` prop so consumers can override the URL pattern. The
  legacy "Timing" column is removed because timing is owned by stages now.
- `NotificationReminderRuleDialog` drops the `Send timing` field and the
  payload always writes `relativeDaysFromDueDate: 0`. New rules are expected
  to define their timing via stages; the dialog's purpose is now creating the
  rule shell + picking a default template + assigning a channel. A help line
  on the create form points the user at "Manage stages" as the next step.
- Adds a perf migration (`0002_reminder_dispatcher_perf`) with partial / composite
  indexes targeting the new dispatcher's hot queries: open invoices by
  `due_date`, open payment schedules by `due_date`, reminder runs by
  `(rule, target, scheduled_for)`, and reminder runs by
  `(recipient, status, processed_at)` for suppression / rate-limit lookups.

---
"@voyantjs/ui": patch
"@voyantjs/notifications": patch
---

Reminder rule dialog: make the default template optional (#488).

Stage channels carry their own templates and override the rule-level default,
so the legacy rule-creation dialog no longer needs to require a template at
form-submit time. Without this, clicking **Create Rule** with no template
selected silently failed Zod validation and the dialog appeared frozen.

Backend `insertNotificationReminderRuleSchema` and
`updateNotificationReminderRuleSchema` drop the `templateId || templateSlug`
refinement to match.

Also narrows the dispatcher's per-target booking lookup from a full-row
`select()` to the columns actually used by recipient resolution. This avoids
projecting every column declared in the bookings schema and tolerates
deployments / test stubs that lag the latest column set.

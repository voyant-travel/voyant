---
"@voyantjs/notifications": patch
---

Honor the stage channel's template at delivery time (#488).

Bug: when the operator's hourly cron sweep
(`notifications.send-due-reminders`) queued a stage's per-channel run
and the `notifications.deliver-reminder` workflow picked it up,
`deliverReminderRun` was passing `rule.templateId` /
`rule.templateSlug` / `rule.channel` / `rule.provider` to the
sender — i.e. the rule-level fallback. The stage channel's own
template (the one operators picked in the channel editor) was never
consulted, so reminders went out with the wrong template (or
silently failed if the rule had no fallback template).

Fix: introduce `resolveChannelOverride(db, run, rule)` that reads
`run.metadata.stageChannelId` (which the dispatcher writes when it
queues the run) and looks up the stage channel. The queued sender
helpers now use the override's `channel` / `templateId` /
`templateSlug` / `provider` and only fall back to rule-level values
when the stage channel can't be resolved.

Also narrows several `db.select().from(bookings|invoices|...)` calls
that were projecting every drizzle-declared column. The narrower
projections only ask for the fields the dispatcher actually reads,
so deployments / test stubs that lag the latest column set don't
break delivery.

Adds an end-to-end integration test
(`reminder-sequences.test.ts > "queues per-channel and uses the
stage channel's template at delivery time"`) that creates two
templates, gives the rule the wrong default and the stage channel
the correct one, queues, delivers, and asserts the recipient got
the stage channel's subject and body.

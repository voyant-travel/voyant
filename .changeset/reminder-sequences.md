---
"@voyantjs/notifications": minor
"@voyantjs/db": patch
---

Add reminder sequences: stages, channels, and notification settings (#488).

Reminder rules can now own an ordered list of **stages**, each with its own anchor (`due_date`, `booking_created_at`, `departure_date`, `invoice_issued_at`, or `last_send_at`), eligibility window (`[startDays, endDays]`), and cadence (`once`, `every_n_days`, or `escalating` with `daysUntilDueGT/LT` buckets). Each stage can fan out to multiple channels, each carrying its own template and recipient kind. This subsumes the legacy single-offset rule (one stage, `cadence: once`, anchor `due_date`) and the counter-based escalation pattern from the issue (one stage with `cadence: escalating(...)` plus sibling stages keyed on cumulative `maxSendsInStage`).

The dispatcher gains a stage-aware path that runs first; rules without stages fall through to the legacy date-offset path (back-compat). The migration creates one stage + one channel per existing rule mirroring the legacy behavior, so existing fires keep working unchanged.

New tables: `notification_reminder_rule_stages` (typeid `ntrs`), `notification_reminder_stage_channels` (typeid `ntsc`), `notification_settings` (typeid `nset`). New columns on `notification_reminder_rules`: `priority`, `suppression_group`. New API surface: stage CRUD, stage channel CRUD, `/notification-settings`, and a read-only `/reminders/preview` that returns what *would* fire on a given date with reasoning attached.

The dispatcher now respects:
- Quiet hours / blackout dates / weekend skips (per `notification_settings`, opt-out per stage via `respectQuietHours`).
- Cross-rule dedup via `suppression_group` and a per-recipient daily channel rate limit.
- Multi-channel stages (one decision → one delivery per channel, dedupe key includes channel).

Engine PR is the first of three milestones; UI hooks (`@voyantjs/notifications-react`) and a new `@voyantjs/notifications-ui` package follow.

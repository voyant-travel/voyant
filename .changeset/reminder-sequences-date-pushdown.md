---
"@voyantjs/notifications": patch
---

Push a date envelope into the dispatcher's open-target SQL (#488).

Closes the perf caveat noted on PR #494: previously
`fetchOpenPaymentScheduleTargets` / `fetchOpenInvoiceTargets` returned
every open row and the in-app stage walk filtered them by
anchor + window. With the partial indexes from `0002` that's already
fast on most deployments, but for tens of thousands of open rows × N
active rules the per-sweep memory footprint grows.

`computeAnchorDateEnvelope(stages, today, anchor)` inverts the
`inWindow` math (`anchor + start ≤ today ≤ anchor + end` →
`today − end ≤ anchor ≤ today − start`) and unions the ranges across
all stages that share the requested anchor. The fetchers now accept
a `DateEnvelopes` map and add a `BETWEEN` clause to the WHERE so
Postgres only returns targets whose anchor date could plausibly fire
today.

Pushdown is enabled per-anchor when at least one of the rule's stages
anchors on it: `due_date` for both target types, `invoice_issued_at`
for invoices. Stages anchored on `departure_date`, `booking_created_at`,
or `last_send_at` fall through to the unfiltered fetch — those are
expected to be rare and the in-app window check still rejects misses.

Adds 4 unit tests for `computeAnchorDateEnvelope` (null, single
stage, union across stages, mixed-anchor isolation). Integration
suite stays 3/3.

Also makes `templates/operator/scripts/migrate.ts` log applied
migrations and prints a clear "restart any long-lived workers" line
afterwards — drizzle's prepared-statement cache is keyed to the old
schema and any worker that started before the migration will fail on
the first query touching a changed column.

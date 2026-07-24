---
"@voyant-travel/legal": minor
---

Restore the approved issue, send, and execute contract Tools with an existing-target
durable command protocol. Each command now commits its action claim, locked contract
transition, immutable result snapshot, preserved send payload, and deterministic
lifecycle outbox event atomically; exact retries return the original Tool output
without repeating state changes or delivery intent.

This release adds the `contract_lifecycle_command_results` table. Apply the Legal
package migration before exposing the restored Tools. Its `contract_id` is an
intentional soft reference so replay history outlives a later permitted contract
deletion. Existing exported Legal service method signatures and Tool output
schemas are unchanged.

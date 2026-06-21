---
"@voyant-travel/legal": patch
---

Stop contract generation from breaking when the `option_unit_type` enum lacks `accommodation`.

The contract-variable resolver filtered `option_units` with `unit_type IN ('room', 'accommodation')`. `accommodation` is not a member of the `option_unit_type` enum on every deployment, so Postgres rejected the statement with `invalid input value for enum option_unit_type: "accommodation"` before it ran — taking down *all* contract generation (admin preview and `POST /v1/admin/legal/contracts/bookings/:id/generate-document`) on any lagging deployment, not just bookings with accommodation units. The column is now compared as text (`unit_type::text IN (...)`), so a value the enum doesn't have simply never matches instead of throwing.

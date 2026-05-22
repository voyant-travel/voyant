---
"@voyantjs/availability": minor
---

`updateSlot` now owns the `remaining_pax` value: any caller-supplied `remainingPax` on a slot PATCH is ignored, and the service atomically recomputes the field inside the same `UPDATE` statement when `initialPax` or `unlimited` changes. The previous behavior trusted whatever value the client sent, which caused two failure modes (issue #1087):

- Stale-snapshot writes — operator forms captured `remainingPax` at dialog-open time and re-submitted it, rolling back any holds / bookings that happened while the form was open.
- Edit-resets-capacity — sending `remainingPax = initialPax` on every save (the operator template's pattern) erased the running consumed count.

The recompute preserves the consumed delta (`new_initial - max(0, old_initial - old_remaining)`, clamped to `[0, new_initial]`) so a capacity bump or shrink rebalances correctly. Switching to `unlimited: true` nulls the field. Edits that don't touch `initialPax` / `unlimited` leave `remaining_pax` alone so concurrent flows (`service-holds`, booking writes, refunds) keep ownership.

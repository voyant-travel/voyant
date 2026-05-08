---
"@voyantjs/availability": minor
---

Fire `availability.slot.changed` from `createSlot` and `deleteSlot`, not just `updateSlot`.

Until now, only operator edits to an existing slot fired the event — adding a brand-new departure or removing one was silent. That works for channel-push (whose reconciler periodically rehydrates) but breaks any subscriber that uses the event as a reindex trigger, including the new catalog-plane departures projection (PR3 of #493).

Changes:

- `AvailabilitySlotChangeSource` adds `"created"` and `"deleted"` variants. Existing values unchanged.
- `createSlot(db, data, runtime?)` and `deleteSlot(db, id, runtime?)` accept a new `SlotMutationRuntime` (alias of the renamed-but-back-compat `UpdateSlotRuntime`). When `eventBus` is provided they emit `availability.slot.changed` with `source` defaulting to `"created"` / `"deleted"`. Existing two-arg calls keep working.
- `deleteSlot` snapshots the slot row before deletion so the event payload carries `productId` / `optionId` / `startsAt`. `remainingPax` is reported as `0` for deletes (post-mutation effective capacity).
- `POST /v1/availability/slots` and `DELETE /v1/availability/slots/:id` now thread `c.get("eventBus")` through to the service layer.

Pre-existing gap not fixed here: the batch-update / batch-delete endpoints still don't thread the event bus through `handleBatchUpdate` / `handleBatchDelete`, so bulk operations keep their existing behavior of suppressing all slot events. Tracked separately — fixing it requires touching the shared batch helpers.

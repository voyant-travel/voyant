---
"@voyantjs/availability-ui": patch
---

Fix `AvailabilityPage` list tabs (Slots, Rules, Start Times, Closeouts, Pickup Points) rendering empty when the selected product's rows sit past the first paginated page. Pass the page's product/status/date/active filters through to `useRules`/`useStartTimes`/`useSlots`/`useCloseouts`/`usePickupPoints` so the server narrows the first 25 rows; client-side filters stay as the safety net for dimensions the API doesn't expose. Mirrors the overview-aggregate fix (#1047) but for list tabs (#1076).

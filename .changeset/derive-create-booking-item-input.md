---
"@voyantjs/bookings-react": patch
---

`CreateBookingItemInput` and `UpdateBookingItemInput` are now derived from the server's `insertBookingItemSchema` / `updateBookingItemSchema` via `z.input<typeof …>` — eliminating drift between the client type and the server's accepted shape. Picks up 7 fields the hand-rolled interface had missed: `productId`, `optionId`, `optionUnitId`, `pricingCategoryId`, `sourceSnapshotId`, `sourceOfferId`, `metadata`. Consumers building "custom itinerary" admin UIs can now pass `productId` / `optionId` to `useBookingItemMutation().create.mutateAsync(...)` without a type assertion.

---
"@voyant-travel/bookings": minor
"@voyant-travel/bookings-contracts": minor
"@voyant-travel/bookings-react": minor
"@voyant-travel/finance": minor
---

Let an operator move a booking to a different departure, and stop the old way of doing it from silently double-booking.

**The hole first.** `updateItem` accepted `availabilitySlotId` and would repoint the item and refresh its snapshots — but never moved the allocation. The old departure kept the seat consumed forever while the new one had nothing reserved and stayed sellable, and the booking read as correctly moved the whole time. That is now refused with a 409 pointing at the move flow; scheduling a line that holds no capacity still works.

**`item_move` Amendment.** Same preview → accept → apply protocol as the rest: the new fare is resolved from the catalog for the target date (honouring departure price overrides and quantity tiers), the operator adds a change fee, and applying releases the old departure's capacity and claims the new one's in a single transaction. A target that fills up between quote and apply fails the guard and the whole move rolls back, so the booking is never left holding neither date.

Supplier-sourced inventory is included — a date change is a modify against the existing reservation, which is what the supplier port already expresses — so a connector that cannot move a booking answers `refused` rather than the move being refused up front.

**Cheaper moves are the operator's call**, per move rather than by policy: give the difference back, hold it as travel credit, or keep the original price. Travel credit issues a real credit against the customer; waive floors the change at zero while leaving any change fee payable.

**UX.** The target departure is a selector over departures that can actually take the booking — open, in the future, on the same product, and with room for the seats being carried — not a free date field. Price is never typed; the quote separates "the new date costs more" from "we charge to change it" so an operator can read it back to a customer.

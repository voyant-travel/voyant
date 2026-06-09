---
"@voyantjs/catalog": patch
"@voyantjs/catalog-contracts": patch
---

Pin sourced stays/package bookings by stable room/rate keys. Booking drafts now
preserve `roomTypeId`, `ratePlanId`, and `board` configure fields, and the
catalog booking engine forwards them to adapter quote/reserve parameters so live
re-resolution can select the exact room and board the operator picked.

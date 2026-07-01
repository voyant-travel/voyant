---
"@voyant-travel/catalog": patch
---

Preserve the draft payload when `/book` is called with an explicit `quoteId`. The book route now loads the booking draft whenever a `draftId` is present — even alongside an explicit `quoteId` — so the selected departure/room/pax/traveler parameters still feed `engineParametersFromDraft`. An explicit `quoteId` continues to override which quote is booked (e.g. a live re-scoped quote) without dropping the draft-derived options.

---
"@voyantjs/catalog": minor
"@voyantjs/accommodations": patch
"@voyantjs/cruises": patch
"@voyantjs/products": patch
---

Extend the source-adapter contract with cache-ownership and reservation-retrieval capabilities. Adapters can now declare `ownsContentCache`, `ownsAvailabilityCache`, and `supportsReservationRetrieval`, and can implement `getReservation` / `listReservations` for authoritative upstream booking reads.

Products, accommodations, and cruises content services now honor `ownsContentCache` by treating adapter content reads as pass-through and skipping sourced-content cache reads and writes.

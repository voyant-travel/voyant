---
"@voyantjs/availability-react": patch
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/bookings-ui": patch
"@voyantjs/catalog-ui": patch
"@voyantjs/i18n": patch
"@voyantjs/products-ui": patch
---

Improve product booking configuration for room-based travel products.

- `@voyantjs/products-ui`: rename the product setup UI around booking options, room inventory, traveler prices, and departure room inventory; hide traveler-age controls for room inventory units; add setup guardrails so room-based products cannot mix the legacy one-option-per-room shape with the canonical single-option/multiple-room-units shape.
- `@voyantjs/bookings` and `@voyantjs/bookings-react`: preserve selected room/category refs through booking creation and quote travelers against the selected room plus traveler pricing category instead of falling back to unrelated rates.
- `@voyantjs/bookings-ui`: let agents select both the room and the traveler pricing category for each traveler when the selected room exposes category-specific prices, enforce room occupancy in the booking flow, and keep the booking summary aligned with the selected room.
- `@voyantjs/availability-react`: expose the additional resource template fields needed by room inventory setup.
- `@voyantjs/i18n`: add Romanian product-management labels for the renamed booking option and inventory concepts.
- `@voyantjs/catalog-ui`: localize ship-spec labels used by the catalog detail sheet.

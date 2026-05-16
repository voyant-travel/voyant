---
"@voyantjs/bookings-ui": patch
"@voyantjs/bookings": patch
---

Make the booking create flow usable for priced room/unit selections by keeping product combobox labels readable, falling back to product departures when option-filtered departures are empty, showing option units before departure selection, and surfacing booking total/scheduled/remaining payment amounts.

Allow the admin pricing preview route to resolve active internal products while keeping storefront pricing previews restricted to public, activated products.

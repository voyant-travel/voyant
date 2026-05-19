---
"@voyantjs/admin": patch
"@voyantjs/bookings": patch
"@voyantjs/bookings-react": patch
"@voyantjs/bookings-ui": patch
"@voyantjs/catalog": patch
"@voyantjs/checkout-ui": patch
"@voyantjs/db": patch
"@voyantjs/finance": patch
"@voyantjs/flights-ui": patch
"@voyantjs/i18n": patch
"@voyantjs/products": patch
"@voyantjs/ui": patch
---

Ship the composed trip admin workflow and booking extras integration.

Admin surfaces now include trip list/detail/composer routes, catalog-backed
trip assembly, aggregate checkout handoff, payment-link trip summaries, and
trip-aware navigation. Booking journeys and regular booking creation can route
operators into the composer when the customer is building a multi-component
itinerary.

Catalog booking draft shapes now expose richer add-on offers, and owned product
booking handlers can price and commit selected extras. Product detail pages can
manage extras, booking create can select extras, and finance booking creation
persists selected extras as booking items so invoices and payment links include
them.

Checkout payment pages now render clearer trip summaries, flight booking UI
supports the refined baggage/one-way behavior used by the composer, shared UI
exports the date-time field, and i18n includes the new trip admin copy.

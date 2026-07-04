---
"@voyant-travel/flights-react": minor
"@voyant-travel/flights": minor
"@voyant-travel/admin": minor
"@voyant-travel/i18n": minor
---

Surface flight orders (bookings/tickets). Adds a Flights → Orders list page (`FlightOrdersPage`) and an order detail route on the packaged flights admin, so a held order — carrying a ticketing deadline — no longer disappears after the confirmation screen. Operators can review orders, filter by status/search, and from the detail view issue tickets (before the deadline) or cancel. Adds a `useFlightOrderTicket` hook and a capability-gated `POST /orders/:orderId/ticket` route to the flights module. The operator admin sidebar now expands Flights into **Search** and **Orders** sub-items (`admin` nav + `i18n` `flightsSearch` label; `flightOrders` label already existed).

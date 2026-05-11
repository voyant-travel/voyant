---
"@voyantjs/storefront-sdk": minor
"@voyantjs/bookings": patch
---

Add a framework-agnostic storefront TypeScript SDK for custom booking UIs.

The SDK wraps existing public storefront, booking-session, and checkout
collection contracts behind a typed client facade, and exposes derived booking
engine state helpers for custom storefront flows. `@voyantjs/bookings` now also
exports the public booking session and overview schemas used by SDK consumers.

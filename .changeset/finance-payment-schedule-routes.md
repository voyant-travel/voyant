---
"@voyant-travel/finance": minor
---

The finance module now owns the booking payment-schedule routes: new exports `createBookingScheduleAdminRoutes(options)`, `createPaymentPolicyPublicRoutes(options)`, and `generatePaymentScheduleForBooking`, with the policy cascade resolvers + operator default injected as options. Also drops two unused dev-only workspace deps (inventory, operations) that finance never imported.

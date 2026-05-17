---
"@voyantjs/notifications": patch
"@voyantjs/customer-portal": patch
"@voyantjs/i18n": patch
---

Quiet/auxiliary updates.

- `@voyantjs/notifications`: `booking.confirmed` subscriber honors a new `suppressNotifications` flag on the event payload so operators can confirm a booking without firing the customer-facing email/doc bundle (data corrections, manual hand-offs).
- `@voyantjs/customer-portal`: public service + validation tightened around the new booking tax-preview shape; integration tests updated to assert the new response.
- `@voyantjs/i18n`: new admin strings for the bookings billing dialog, finance tax-preview labels, CRM operator screens, and products operator surface (EN + RO).

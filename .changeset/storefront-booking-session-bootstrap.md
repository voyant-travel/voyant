---
"@voyantjs/storefront": minor
---

Add a public storefront booking-session bootstrap contract at
`POST /v1/public/bookings/sessions/bootstrap`. The route validates the selected
departure/slot and original quote, creates the public booking session, applies a
finance payment schedule, and returns customer-safe session, repricing,
availability, allocation, payment plan, due schedule, and checkout capability
state in one response.

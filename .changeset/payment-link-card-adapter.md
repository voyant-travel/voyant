---
"@voyant-travel/trips": minor
---

Charge payment links by card through the deployment's connected processor.

The Storefront payment-link `start-card` path was a stub that always reported
"not configured" (503), so only the full booking checkout could take card
payments. The trips runtime contributor now threads the selected payment adapter
into the payment-link route options, wiring `startCardPayment` to the same
neutral finance card starter the checkout path uses — so a card payment link
redirects the customer to the connected processor's hosted checkout.

Also corrects the processor notify (IPN) URL to the operator API mount:
`${publicCheckoutBaseUrl}/api/v1/public/payment-link/callback` (was missing the
`/api` prefix), so the processor's server-side confirmation reaches the
deployment webhook.

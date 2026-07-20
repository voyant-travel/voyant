---
"@voyant-travel/finance": minor
"@voyant-travel/trips": minor
---

Pass the deployment's public payment webhook to the card processor as
`metadata.notifyUrl` when starting a hosted payment. The generic payment
adapter forwards it to the connected processor worker so redirect processors
(e.g. Netopia) POST their server-side confirmation (IPN) back to
`/v1/public/payment-link/callback`, closing the charge-confirmation loop.
Finance's card-payment starter gains an optional `resolveNotifyUrl(c)`; the
Storefront-selected trips runtime derives it from the public checkout base URL.

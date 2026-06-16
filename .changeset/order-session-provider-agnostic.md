---
"@voyant-travel/finance": patch
---

`createOrderPaymentSessions` no longer hard-codes `provider: "netopia"` / `paymentMethod: "credit_card"` when creating a session. Sessions are now provider-agnostic by default (both `null`) so the injected starter claims the provider when it runs — correct for Stripe/Adyen/bank-transfer deployments. A deployment may opt into stamping a default via the new `provider` / `paymentMethod` options on `createOrderPaymentSessions`.

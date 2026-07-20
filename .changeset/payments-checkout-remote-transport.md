---
"@voyant-travel/payments": minor
"@voyant-travel/storefront": minor
---

Managed card checkout (Phase 2B): the concrete control-plane remote payment transport that the generic `createRemotePaymentAdapter` delegates to (brokers initiate/status/verifyCallback to the platform payments control plane), plus the inbound processor IPN webhook (`POST /v1/public/payment-link/callback`) that verifies the callback through the payment adapter and applies the event. Together these let a connected processor actually charge cards without the deployment bundling any per-processor SDK.

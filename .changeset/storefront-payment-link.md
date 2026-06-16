---
"@voyant-travel/storefront": minor
---

The storefront module now owns the public payment-link / checkout-status routes: new `@voyant-travel/storefront/payment-link` export (`createPaymentLinkRoutes(options)`). The trips / inventory / payment-provider / operator-settings reads are injected as options (bookings + finance are read directly).

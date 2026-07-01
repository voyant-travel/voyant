---
"@voyant-travel/catalog-contracts": patch
"@voyant-travel/catalog": patch
"@voyant-travel/inventory": patch
"@voyant-travel/bookings-react": patch
---

Offer bank transfer and inquiry on owned-product storefront checkout.

The owned-product booking draft shape hardcoded `paymentIntents: ["hold",
"card"]`, so the storefront Payment step collapsed to card-only for owned
products even though the deployment advertised bank transfer and inquiry
(sourced products already offered all three). Both product draft shapes now
declare the full engine allow list via a shared `DEFAULT_PAYMENT_INTENTS`
constant, and deployment/surface `PaymentProviderCapabilities` narrow it at
render time — so owned and sourced products offer the same payment paths. The
`/checkout/start` flow already handled bank transfer and inquiry generically on
the booking row, so no server change was needed.

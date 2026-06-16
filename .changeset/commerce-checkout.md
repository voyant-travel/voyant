---
"@voyant-travel/commerce": minor
---

The commerce module now owns the catalog-checkout materialization/finalize logic: new `@voyant-travel/commerce/checkout` surface (`createCatalogCheckoutRoutes`, `startCatalogCheckout`, `materializeBookingFromSnapshot`, `dispatchCheckoutFinalize`, `rebuildBookingItemTaxLines`, etc.). Deployment specifics — tax settings, owned-product lookup, bank-transfer instructions, contract-pdf generator, and the card-payment provider start (`startCardPayment`) — are injected as options. `quotes` and `legal` are now optional peer dependencies (used only on the quote-version / contract checkout paths).

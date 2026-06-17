---
"@voyant-travel/framework": minor
---

Collapse the booking-tax reader injection (Workstream B step 4, Stage 2a). The framework's `finance/booking-tax-extension` factory now reads `resolveBookingTaxSettings` / `updateBookingTaxSettings` straight from the standard `@voyant-travel/operator-settings` package instead of from injected providers.

`FrameworkProviders` drops `resolveBookingTaxSettings` + `updateBookingTaxSettings`, and the operator deployment stops wiring them in `buildOperatorProviders`. This is the decided framework-layer wiring (open-question 2): no leaf module depends on operator-settings — only the framework assembly layer does (added as a dev + peer dependency, kept out of the BOM-locked `dependencies`). operator-settings stays `additionalSchemas`-only, so the runtime/BOM lockstep set is unchanged (16).

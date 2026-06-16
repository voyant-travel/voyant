---
"@voyant-travel/framework": minor
---

Relocate the 2 injection-shaped standard extensions into `frameworkComposition.extensions` (Workstream B, Tier 3b — completes Tier 3):

- **finance/booking-tax** — `createBookingTaxHonoExtension` now lives in the framework factory; `FrameworkProviders` gains `resolveBookingTaxSettings` + `updateBookingTaxSettings` (typed via `BookingTaxRouteOptions`).
- **distribution/channel-push** — its builder is genuinely deployment-wired (booking-engine registry), so it's injected as a `createChannelPushExtension: () => HonoExtension` provider; the framework owns the manifest entry while the deployment supplies the builder. This previews the Tier 4 injected-builder pattern.

All standard `@voyant-travel/*` extensions are now framework-owned.

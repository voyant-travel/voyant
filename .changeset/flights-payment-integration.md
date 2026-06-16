---
"@voyant-travel/flights": minor
---

New `createFlightOrderPaymentIntegration(deps)` (from `@voyant-travel/flights` and `./payment-integration`) — maps a flight order to payment-session params + card billing and returns a `FlightPaymentIntegration`. The generic session service and the card provider are injected structurally (no finance/provider dependency in flights), so the deployment supplies only its provider choices.

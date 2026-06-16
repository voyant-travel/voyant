---
"@voyant-travel/finance": minor
"@voyant-travel/plugin-netopia": minor
---
Provider-agnostic card-payment seam: `@voyant-travel/finance` defines the `CardPaymentStarter` contract (`./card-payment`), `@voyant-travel/plugin-netopia` provides `netopiaCardPaymentStarter()`, and the deployment selects its processor in one place. Swapping card processors is a one-line change; checkout surfaces (flights, trips, payment links, catalog) route through the interface.

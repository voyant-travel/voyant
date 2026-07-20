---
"@voyant-travel/trips": patch
---

Keep the Trips runtime contributor's Storefront payment-link registration inline
(`[storefrontPaymentLinkRuntimePort.id]: createStandardPaymentLinkRouteOptions(...)`)
so it satisfies the `storefront-subscriber-authority` architecture check, while
still threading the selected payment adapter into the payment-link route options.
`createStandardPaymentLinkRouteOptions` now accepts an already-resolved adapter
or a promise and resolves it lazily inside the card-payment starter.

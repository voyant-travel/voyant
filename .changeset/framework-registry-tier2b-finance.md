---
"@voyant-travel/framework": minor
---

Relocate the **finance** module factory into `frameworkComposition` (Workstream B, Tier 2b — completes Tier 2). This is the last and largest capability-shaped module: its notifications→checkout adapter helpers (`toCheckoutNotificationDelivery`, `toCheckoutReminderRun`, `optionalDateTime` + the `NotificationDeliveryLike`/`NotificationReminderRunLike` types) move into the framework alongside the factory.

`FrameworkProviders` gains `createInvoiceExchangeRateResolver`, `createInvoiceSettlementPollers`, `resolveBankTransferDetails` (typed via `FinanceHonoModuleOptions` indexed access) and `netopiaCheckoutStarter` (`CheckoutPaymentStarter` — Netopia stays injected, never imported by the framework). Finance also reuses the already-relocated `resolveDocumentDownloadUrl`, `resolvePublicCheckoutBaseUrl`, and `resolveNotificationProviders` providers, confirming those shared fields satisfy multiple package option contracts.

With finance done, all 21 standard `@voyant-travel/*` modules are framework-owned; only the standard extensions (Tier 3) and the `operator/*` lazy families (Tier 4) remain in the deployment registry.

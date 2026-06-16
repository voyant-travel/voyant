---
"@voyant-travel/framework": minor
---

Relocate the first capability-shaped standard module factories into `frameworkComposition` (Workstream B, Tier 2a): **bookings, storefront/customer-portal, storefront/verification, trips**. These read injected providers off `ctx.capabilities` rather than being hand-wired in the deployment.

`FrameworkProviders` gains its first real fields — `relationshipsService`, `closePaymentSchedulesForBooking`, `resolveDocumentDownloadUrl`, `resolveNotificationProviders`, `createTripsRoutesOptions` — each typed by the package option type it feeds (`NonNullable<XOptions["field"]>`) or by a package service (`typeof relationshipsService`), so the provider contract can't drift from what the factories pass it into. A deployment's capability container now structurally `extends FrameworkProviders`.

`public-document-delivery` is intentionally deferred: its storage provider takes the deployment's narrow `CloudflareBindings`, which surfaces a bindings-variance design question for the provider contract — to be resolved with the storage/document group rather than papered over.

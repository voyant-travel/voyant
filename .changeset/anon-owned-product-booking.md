---
"@voyant-travel/inventory": patch
---

Owned product booking commit now resolves (or creates) a CRM person from the
billing contact when the commit carries no `personId`/`organizationId` — the
anonymous storefront checkout case. `createProductsBookingHandler` accepts a new
optional `resolveBillingPerson` bridge (wired by the template to
`relationshipsService.upsertPersonFromContact`), mirroring the sourced/session
arm's `resolveBillingPerson` hook. This fixes anonymous storefront checkout for
owned public products, which previously failed with a 400 "Select a billing
person or organization".

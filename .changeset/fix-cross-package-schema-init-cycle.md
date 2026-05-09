---
"@voyantjs/bookings": patch
"@voyantjs/crm": patch
"@voyantjs/transactions": patch
"@voyantjs/storefront": patch
---

Fix #501: cross-package schema init cycle that caused chunk-splitting bundlers (Vite 8 / Rolldown) to crash with `Cannot read properties of undefined (reading 'optional')` at module-evaluation time.

Root cause: schema files in 4 packages dereferenced a Zod schema imported from another `@voyantjs/*` package at module top level. When the bundler placed the producer (`kmsEnvelopeSchema` from `@voyantjs/db`, `availabilitySlotStatusSchema` from `@voyantjs/availability`, `extraPricingModeSchema` from `@voyantjs/extras`) into a different chunk than the consumer, ESM live-binding init order didn't guarantee producer-before-consumer evaluation — the consumer hit the producer's TDZ and threw.

Fix: wrap every cross-package top-level schema reference with `z.lazy(() => Schema)` so the schema is dereferenced at first parse rather than at module evaluation. This is the smallest change per the issue's suggested fixes (Option 1) and protects against the same hazard in any future bundler chunking.

Sites updated:

- `@voyantjs/bookings/schema/travel-details` — 3 `kmsEnvelopeSchema` fields (`identityEncrypted`, `dietaryEncrypted`, `accessibilityEncrypted`)
- `@voyantjs/crm/validation` — 5 `kmsEnvelopeSchema` fields (`accessibilityEncrypted`, `dietaryEncrypted`, `loyaltyEncrypted`, `insuranceEncrypted`, `numberEncrypted` on personDocuments)
- `@voyantjs/transactions/schema/participant-identity` — 1 `kmsEnvelopeSchema` field (`identityEncrypted`)
- `@voyantjs/storefront/validation` — `availabilitySlotStatusSchema` + `extraPricingModeSchema` on the storefront departure / extension schemas

Behavior unchanged: `z.lazy(fn).optional().nullable()` parses identically to `Schema.optional().nullable()` for valid and invalid payloads. Regression test in `packages/bookings/tests/unit/travel-details-schema.test.ts` asserts both the happy path (valid envelope round-trips) and the error path (empty `enc` violates the producer's `min(1)` validation) continue to work through the lazy wrap.

No schema migration required, no behavior change for consumers — purely a build-time / module-init shape fix.

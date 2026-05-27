---
"@voyantjs/bookings-ui": patch
"@voyantjs/i18n": patch
"@voyantjs/legal": patch
"@voyantjs/legal-ui": patch
---

Follow-ups to the booking-detail UX overhaul (#1332):

- **Status change dialog (`@voyantjs/bookings-ui`)**: surface the existing `suppressNotifications` API as a switch in `StatusChangeDialog`. The toggle only appears when the target status is `confirmed` (the only transition that honors the flag server-side per `status-dispatch.ts`) and routes the value through to `useBookingStatusMutation`. Lets operators confirm a booking silently — no confirmation email, no document bundle. EN/RO labels added.
- **Booking documents tab (`templates/operator`)**: contracts table now has an "Open contract page" icon action linking to `/legal/contracts/$id`. EN/RO copy added under `bookings.detail.documentsTable.contractOpenTooltip`.
- **Contract detail page (`@voyantjs/legal-ui`)**: delete button now renders for `void` contracts too, not just drafts.
- **Contract delete API (`@voyantjs/legal`)**: `deleteContract` accepts `draft | void` (was draft-only). Returns `not_deletable` instead of `not_draft`; route error message updated to "Only draft or void contracts can be deleted".
- **Contract auto-generation (issue #1335, `@voyantjs/legal`)**: `issueContract` now allocates the series number **before** rendering and merges it into the render variables, so templates that print `{{ contract.number }}` / `{{ contract.contractNumber }}` resolve on the first issued PDF. The allocated number is also persisted back into `contract.variables` so regenerations stay consistent. Same merge applied in `ensureRenderedContract` for the deferred-render fallback path. New `mergeContractNumberIntoVariables` helper (exported) + 4 unit tests.

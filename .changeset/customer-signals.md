---
"@voyantjs/crm": patch
"@voyantjs/crm-react": patch
"@voyantjs/db": patch
---

Add `customer_signals` table for the pre-pipeline interest surface (closes #444).

Customer signals are the lighter-than-opportunities, heavier-than-segments space — wishlist entries, "notify when this departure opens", inquiry calls captured by an operator, abandoned-cart recovery, request-offer leads. The new `crm.customer_signals` table records:

- `kind` — `wishlist | notify | inquiry | request_offer | referral`.
- `source` — `form | phone | admin | abandoned_cart | website | booking`.
- `status` — `new | contacted | qualified | converted | lost | expired`, default `new`.
- `priority` (text, validation-layer enum `low | normal | high | urgent`), `notes`, `tags`, `assignedToUserId`, `followUpAt`, `sourceSubmissionId`, `metadata`.
- `productId`, `optionUnitId`, `resolvedBookingId` as plain `text()` columns — cross-module references stay loose per the project FK rule.

API:

- `crmService.listCustomerSignals(db, { personId?, assignedToUserId?, status?, kind?, productId?, search? })` paginated.
- `crmService.listSignalsForPerson(db, personId)` chronological convenience.
- CRUD + `crmService.resolveCustomerSignalToBooking(db, signalId, bookingId)` which marks the signal `converted` and pins the bookingId.
- Admin routes: `GET/POST /v1/admin/crm/customer-signals`, `GET/PATCH/DELETE /v1/admin/crm/customer-signals/:id`, `POST /v1/admin/crm/customer-signals/:id/resolve`, `GET /v1/admin/crm/people/:id/signals`.
- React hooks: `useCustomerSignals(filters)`, `useCustomerSignalsForPerson(personId)`, `useCustomerSignal(id)`, `useCustomerSignalMutation()` returning `{ create, update, remove, resolve }`.

Migration: `templates/operator/migrations/0027_customer_signals.sql`, registered in `meta/_journal.json`.

Out of scope (deferred): full "create booking from signal" orchestration UI; auto-expiry cron that sweeps stale signals to `expired`. The data layer supports both.

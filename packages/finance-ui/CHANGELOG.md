# @voyantjs/finance-ui

## 0.57.0

### Patch Changes

- @voyantjs/bookings-ui@0.57.0
- @voyantjs/finance@0.57.0
- @voyantjs/finance-react@0.57.0
- @voyantjs/i18n@0.57.0
- @voyantjs/suppliers-ui@0.57.0
- @voyantjs/ui@0.57.0

## 0.56.0

### Patch Changes

- @voyantjs/bookings-ui@0.56.0
- @voyantjs/finance@0.56.0
- @voyantjs/finance-react@0.56.0
- @voyantjs/i18n@0.56.0
- @voyantjs/suppliers-ui@0.56.0
- @voyantjs/ui@0.56.0

## 0.55.1

### Patch Changes

- Updated dependencies [819c847]
  - @voyantjs/bookings-ui@0.55.1
  - @voyantjs/finance@0.55.1
  - @voyantjs/finance-react@0.55.1
  - @voyantjs/i18n@0.55.1
  - @voyantjs/suppliers-ui@0.55.1
  - @voyantjs/ui@0.55.1

## 0.55.0

### Patch Changes

- @voyantjs/bookings-ui@0.55.0
- @voyantjs/finance@0.55.0
- @voyantjs/finance-react@0.55.0
- @voyantjs/i18n@0.55.0
- @voyantjs/suppliers-ui@0.55.0
- @voyantjs/ui@0.55.0

## 0.54.0

### Patch Changes

- Updated dependencies [3117d27]
  - @voyantjs/bookings-ui@0.54.0
  - @voyantjs/finance@0.54.0
  - @voyantjs/finance-react@0.54.0
  - @voyantjs/i18n@0.54.0
  - @voyantjs/suppliers-ui@0.54.0
  - @voyantjs/ui@0.54.0

## 0.53.2

### Patch Changes

- @voyantjs/bookings-ui@0.53.2
- @voyantjs/finance@0.53.2
- @voyantjs/finance-react@0.53.2
- @voyantjs/i18n@0.53.2
- @voyantjs/suppliers-ui@0.53.2
- @voyantjs/ui@0.53.2

## 0.53.1

### Patch Changes

- @voyantjs/bookings-ui@0.53.1
- @voyantjs/finance@0.53.1
- @voyantjs/finance-react@0.53.1
- @voyantjs/i18n@0.53.1
- @voyantjs/suppliers-ui@0.53.1
- @voyantjs/ui@0.53.1

## 0.53.0

### Patch Changes

- @voyantjs/bookings-ui@0.53.0
- @voyantjs/finance@0.53.0
- @voyantjs/finance-react@0.53.0
- @voyantjs/i18n@0.53.0
- @voyantjs/suppliers-ui@0.53.0
- @voyantjs/ui@0.53.0

## 0.52.4

### Patch Changes

- Updated dependencies [5d3c119]
- Updated dependencies [5d3c119]
  - @voyantjs/bookings-ui@0.52.4
  - @voyantjs/finance@0.52.4
  - @voyantjs/finance-react@0.52.4
  - @voyantjs/i18n@0.52.4
  - @voyantjs/suppliers-ui@0.52.4
  - @voyantjs/ui@0.52.4

## 0.52.3

### Patch Changes

- 9679a57: Add the initial action ledger package with append-only ledger schemas, TypeID prefixes, canonical idempotency fingerprints, capability registry and guard helpers, query helpers, request-context ledger helpers, shared target timeline serialization, payload/relay append support, booking PII sensitive-read ledgering, booking traveler and travel-detail mutation ledgering, booking item/note/payment-policy mutation ledgering, booking action capability declarations and approval decision routing, booking action-ledger drift checks and dry-run remediation planning, finance invoice issuance/update/delete, invoice line-item ledgering, payment-session creation/update/lifecycle completion/failure/cancellation/expiration, payment instrument and authorization/capture ledgering, booking payment schedule and guarantee/default-plan ledgering, manual payment, supplier payment, and credit-note plus credit-note line-item ledgering, product create/update/delete ledgering with changed-field summaries and product timelines, nested product option, option-unit, translation, itinerary, day, day-service, media, brochure, feature, FAQ, location, taxonomy-link, destination-link, activation-setting, ticket-setting, visibility-setting, capability, and delivery-format mutation ledgering, product action-ledger drift checks, product admin route module splitting, admin list/detail routes with expanded filters and time windows plus payload and relay refs, relay outbox health listing with time windows and lifecycle helpers, runtime schema/route mounting, finance React client hooks for invoice and payment-session action ledger timelines, operator invoice/payment-session timeline mounting, product React client hooks and product detail activity UI, drift/canary health helpers and operator health endpoints, reversal recording support, route schema module split, client-safe React validation subpath imports, and reusable finance UI action ledger cards.
- Updated dependencies [9679a57]
- Updated dependencies [9679a57]
  - @voyantjs/bookings-ui@0.52.3
  - @voyantjs/finance@0.52.3
  - @voyantjs/finance-react@0.52.3
  - @voyantjs/i18n@0.52.3
  - @voyantjs/suppliers-ui@0.52.3
  - @voyantjs/ui@0.52.3

## 0.52.2

### Patch Changes

- 3e09123: Finance: tax-on-issue + invoice flow refresh.

  - `finance/service-issue.ts` is the new home for the invoice-issue pipeline: it computes line-level tax at issue time, snapshots the resolved tax regime onto the invoice, and emits the events expected by the SmartBill plugin.
  - `service-booking-create.ts` and `service.ts` route through the issue service so converting a booking to an invoice picks up the same tax/regime logic as a direct issue.
  - New route added to expose the tax-preview surface consumed by `useBookingTaxPreview`.
  - `useInvoiceMutation` refreshes the booking invoices/pricing caches after issue/void/refund so detail pages no longer go stale.
  - `PaymentsPage` styling and empty-state polish; new i18n strings for the issue/preview flow (EN + RO via `i18n/admin/finance`).

- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
- Updated dependencies [6bdfcbc]
- Updated dependencies [3e09123]
- Updated dependencies [3e09123]
  - @voyantjs/bookings-ui@0.52.2
  - @voyantjs/finance@0.52.2
  - @voyantjs/finance-react@0.52.2
  - @voyantjs/i18n@0.52.2
  - @voyantjs/suppliers-ui@0.52.2
  - @voyantjs/ui@0.52.2

## 0.52.1

### Patch Changes

- @voyantjs/bookings-ui@0.52.1
- @voyantjs/finance@0.52.1
- @voyantjs/finance-react@0.52.1
- @voyantjs/i18n@0.52.1
- @voyantjs/suppliers-ui@0.52.1
- @voyantjs/ui@0.52.1

## 0.52.0

### Patch Changes

- @voyantjs/bookings-ui@0.52.0
- @voyantjs/finance@0.52.0
- @voyantjs/finance-react@0.52.0
- @voyantjs/i18n@0.52.0
- @voyantjs/suppliers-ui@0.52.0
- @voyantjs/ui@0.52.0

## 0.51.1

### Patch Changes

- Updated dependencies [deaacb3]
  - @voyantjs/bookings-ui@0.51.1
  - @voyantjs/finance@0.51.1
  - @voyantjs/finance-react@0.51.1
  - @voyantjs/i18n@0.51.1
  - @voyantjs/suppliers-ui@0.51.1
  - @voyantjs/ui@0.51.1

## 0.51.0

### Patch Changes

- Updated dependencies [2316791]
  - @voyantjs/bookings-ui@0.51.0
  - @voyantjs/finance@0.51.0
  - @voyantjs/finance-react@0.51.0
  - @voyantjs/i18n@0.51.0
  - @voyantjs/suppliers-ui@0.51.0
  - @voyantjs/ui@0.51.0

## 0.50.8

### Patch Changes

- Updated dependencies [f35014f]
  - @voyantjs/bookings-ui@0.50.8
  - @voyantjs/finance@0.50.8
  - @voyantjs/finance-react@0.50.8
  - @voyantjs/i18n@0.50.8
  - @voyantjs/suppliers-ui@0.50.8
  - @voyantjs/ui@0.50.8

## 0.50.7

### Patch Changes

- Updated dependencies [7e4593e]
  - @voyantjs/bookings-ui@0.50.7
  - @voyantjs/finance@0.50.7
  - @voyantjs/finance-react@0.50.7
  - @voyantjs/i18n@0.50.7
  - @voyantjs/suppliers-ui@0.50.7
  - @voyantjs/ui@0.50.7

## 0.50.6

### Patch Changes

- Updated dependencies [c14f0a8]
  - @voyantjs/bookings-ui@0.50.6
  - @voyantjs/finance@0.50.6
  - @voyantjs/finance-react@0.50.6
  - @voyantjs/i18n@0.50.6
  - @voyantjs/suppliers-ui@0.50.6
  - @voyantjs/ui@0.50.6

## 0.50.5

### Patch Changes

- @voyantjs/bookings-ui@0.50.5
- @voyantjs/finance@0.50.5
- @voyantjs/finance-react@0.50.5
- @voyantjs/i18n@0.50.5
- @voyantjs/suppliers-ui@0.50.5
- @voyantjs/ui@0.50.5

## 0.50.4

### Patch Changes

- @voyantjs/bookings-ui@0.50.4
- @voyantjs/finance@0.50.4
- @voyantjs/finance-react@0.50.4
- @voyantjs/i18n@0.50.4
- @voyantjs/suppliers-ui@0.50.4
- @voyantjs/ui@0.50.4

## 0.50.3

### Patch Changes

- Updated dependencies [f6e051e]
  - @voyantjs/bookings-ui@0.50.3
  - @voyantjs/finance@0.50.3
  - @voyantjs/finance-react@0.50.3
  - @voyantjs/i18n@0.50.3
  - @voyantjs/suppliers-ui@0.50.3
  - @voyantjs/ui@0.50.3

## 0.50.2

### Patch Changes

- @voyantjs/bookings-ui@0.50.2
- @voyantjs/finance@0.50.2
- @voyantjs/finance-react@0.50.2
- @voyantjs/i18n@0.50.2
- @voyantjs/suppliers-ui@0.50.2
- @voyantjs/ui@0.50.2

## 0.50.1

### Patch Changes

- Updated dependencies [7b768c5]
  - @voyantjs/bookings-ui@0.50.1
  - @voyantjs/finance@0.50.1
  - @voyantjs/finance-react@0.50.1
  - @voyantjs/i18n@0.50.1
  - @voyantjs/suppliers-ui@0.50.1
  - @voyantjs/ui@0.50.1

## 0.50.0

### Patch Changes

- @voyantjs/bookings-ui@0.50.0
- @voyantjs/finance@0.50.0
- @voyantjs/finance-react@0.50.0
- @voyantjs/i18n@0.50.0
- @voyantjs/suppliers-ui@0.50.0
- @voyantjs/ui@0.50.0

## 0.49.0

### Patch Changes

- @voyantjs/bookings-ui@0.49.0
- @voyantjs/finance@0.49.0
- @voyantjs/finance-react@0.49.0
- @voyantjs/i18n@0.49.0
- @voyantjs/suppliers-ui@0.49.0
- @voyantjs/ui@0.49.0

## 0.48.0

### Patch Changes

- @voyantjs/bookings-ui@0.48.0
- @voyantjs/finance@0.48.0
- @voyantjs/finance-react@0.48.0
- @voyantjs/i18n@0.48.0
- @voyantjs/suppliers-ui@0.48.0
- @voyantjs/ui@0.48.0

## 0.47.0

### Patch Changes

- Updated dependencies [65408c6]
  - @voyantjs/bookings-ui@0.47.0
  - @voyantjs/finance@0.47.0
  - @voyantjs/finance-react@0.47.0
  - @voyantjs/i18n@0.47.0
  - @voyantjs/suppliers-ui@0.47.0
  - @voyantjs/ui@0.47.0

## 0.46.0

### Patch Changes

- @voyantjs/bookings-ui@0.46.0
- @voyantjs/finance@0.46.0
- @voyantjs/finance-react@0.46.0
- @voyantjs/i18n@0.46.0
- @voyantjs/suppliers-ui@0.46.0
- @voyantjs/ui@0.46.0

## 0.45.0

### Patch Changes

- @voyantjs/bookings-ui@0.45.0
- @voyantjs/finance@0.45.0
- @voyantjs/finance-react@0.45.0
- @voyantjs/i18n@0.45.0
- @voyantjs/suppliers-ui@0.45.0
- @voyantjs/ui@0.45.0

## 0.44.0

### Patch Changes

- Updated dependencies [2bc4a60]
  - @voyantjs/bookings-ui@0.44.0
  - @voyantjs/finance@0.44.0
  - @voyantjs/finance-react@0.44.0
  - @voyantjs/i18n@0.44.0
  - @voyantjs/suppliers-ui@0.44.0
  - @voyantjs/ui@0.44.0

## 0.43.0

### Patch Changes

- @voyantjs/bookings-ui@0.43.0
- @voyantjs/finance@0.43.0
- @voyantjs/finance-react@0.43.0
- @voyantjs/i18n@0.43.0
- @voyantjs/suppliers-ui@0.43.0
- @voyantjs/ui@0.43.0

## 0.42.0

### Patch Changes

- Updated dependencies [786945f]
  - @voyantjs/bookings-ui@0.42.0
  - @voyantjs/finance@0.42.0
  - @voyantjs/finance-react@0.42.0
  - @voyantjs/i18n@0.42.0
  - @voyantjs/suppliers-ui@0.42.0
  - @voyantjs/ui@0.42.0

## 0.41.3

### Patch Changes

- @voyantjs/bookings-ui@0.41.3
- @voyantjs/finance@0.41.3
- @voyantjs/finance-react@0.41.3
- @voyantjs/i18n@0.41.3
- @voyantjs/suppliers-ui@0.41.3
- @voyantjs/ui@0.41.3

## 0.41.2

### Patch Changes

- @voyantjs/bookings-ui@0.41.2
- @voyantjs/finance@0.41.2
- @voyantjs/finance-react@0.41.2
- @voyantjs/i18n@0.41.2
- @voyantjs/suppliers-ui@0.41.2
- @voyantjs/ui@0.41.2

## 0.41.1

### Patch Changes

- @voyantjs/bookings-ui@0.41.1
- @voyantjs/finance@0.41.1
- @voyantjs/finance-react@0.41.1
- @voyantjs/i18n@0.41.1
- @voyantjs/suppliers-ui@0.41.1
- @voyantjs/ui@0.41.1

## 0.41.0

### Patch Changes

- @voyantjs/bookings-ui@0.41.0
- @voyantjs/finance@0.41.0
- @voyantjs/finance-react@0.41.0
- @voyantjs/i18n@0.41.0
- @voyantjs/suppliers-ui@0.41.0
- @voyantjs/ui@0.41.0

## 0.40.1

### Patch Changes

- @voyantjs/bookings-ui@0.40.1
- @voyantjs/finance@0.40.1
- @voyantjs/finance-react@0.40.1
- @voyantjs/i18n@0.40.1
- @voyantjs/suppliers-ui@0.40.1
- @voyantjs/ui@0.40.1

## 0.40.0

### Patch Changes

- @voyantjs/bookings-ui@0.40.0
- @voyantjs/finance@0.40.0
- @voyantjs/finance-react@0.40.0
- @voyantjs/i18n@0.40.0
- @voyantjs/suppliers-ui@0.40.0
- @voyantjs/ui@0.40.0

## 0.39.0

### Patch Changes

- f01fc0f: Add replacement content slots to operator detail pages so consumers can mount custom CRUD panels without duplicating the shipped read-only sections.
- Updated dependencies [f4235ea]
- Updated dependencies [2297949]
  - @voyantjs/bookings-ui@0.39.0
  - @voyantjs/finance@0.39.0
  - @voyantjs/finance-react@0.39.0
  - @voyantjs/i18n@0.39.0
  - @voyantjs/suppliers-ui@0.39.0
  - @voyantjs/ui@0.39.0

## 0.38.2

### Patch Changes

- @voyantjs/bookings-ui@0.38.2
- @voyantjs/finance@0.38.2
- @voyantjs/finance-react@0.38.2
- @voyantjs/i18n@0.38.2
- @voyantjs/suppliers-ui@0.38.2
- @voyantjs/ui@0.38.2

## 0.38.1

### Patch Changes

- @voyantjs/bookings-ui@0.38.1
- @voyantjs/finance@0.38.1
- @voyantjs/finance-react@0.38.1
- @voyantjs/i18n@0.38.1
- @voyantjs/suppliers-ui@0.38.1
- @voyantjs/ui@0.38.1

## 0.38.0

### Patch Changes

- @voyantjs/bookings-ui@0.38.0
- @voyantjs/finance@0.38.0
- @voyantjs/finance-react@0.38.0
- @voyantjs/i18n@0.38.0
- @voyantjs/suppliers-ui@0.38.0
- @voyantjs/ui@0.38.0

## 0.37.1

### Patch Changes

- @voyantjs/bookings-ui@0.37.1
- @voyantjs/finance@0.37.1
- @voyantjs/finance-react@0.37.1
- @voyantjs/i18n@0.37.1
- @voyantjs/suppliers-ui@0.37.1
- @voyantjs/ui@0.37.1

## 0.37.0

### Minor Changes

- 02287bf: Add a reusable booking combobox and use it in finance dialogs instead of raw booking ID inputs.
- a48660e: Add invoice bulk selection and a confirmable mark-paid action with partial-failure feedback.

### Patch Changes

- 0689fcb: Add reusable person, organization, supplier, product, and pricing option comboboxes for operator-facing entity reference fields.
- f014fd2: Capture manual base-currency settlement amounts for cross-currency customer and supplier payments, and settle invoice balances from the base invoice amount.
- 0c9b884: Route remaining reusable UI literals through package i18n providers and add the UI literal scan to the shared i18n CI check.
- Updated dependencies [eef2df0]
- Updated dependencies [4c93561]
- Updated dependencies [dc29b79]
- Updated dependencies [02287bf]
- Updated dependencies [0689fcb]
- Updated dependencies [a48660e]
- Updated dependencies [f014fd2]
- Updated dependencies [0c9b884]
- Updated dependencies [e5ce6a0]
  - @voyantjs/bookings-ui@0.37.0
  - @voyantjs/finance@0.37.0
  - @voyantjs/finance-react@0.37.0
  - @voyantjs/i18n@0.37.0
  - @voyantjs/suppliers-ui@0.37.0
  - @voyantjs/ui@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/finance@0.36.0
- @voyantjs/finance-react@0.36.0
- @voyantjs/i18n@0.36.0
- @voyantjs/ui@0.36.0

## 0.35.0

### Patch Changes

- Updated dependencies [baa6134]
  - @voyantjs/finance@0.35.0
  - @voyantjs/finance-react@0.35.0
  - @voyantjs/i18n@0.35.0
  - @voyantjs/ui@0.35.0

## 0.34.0

### Minor Changes

- 57157cb: Compact the payment policy editor and localize its form and preview copy.

### Patch Changes

- 66ab219: Polish the invoice detail page with a dialog-based note flow, lighter detail sections, and a clearer invoice header.
- 70ee277: Add a shared CurrencyInput and use it for editable operator money fields so forms display decimal amounts with the currency symbol and code while still submitting minor units.
- Updated dependencies [6ad175a]
- Updated dependencies [9095837]
- Updated dependencies [70ee277]
- Updated dependencies [f2d4802]
  - @voyantjs/finance@0.34.0
  - @voyantjs/finance-react@0.34.0
  - @voyantjs/i18n@0.34.0
  - @voyantjs/ui@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/finance@0.33.1
- @voyantjs/finance-react@0.33.1
- @voyantjs/i18n@0.33.1
- @voyantjs/ui@0.33.1

## 0.33.0

### Patch Changes

- Updated dependencies [db46afc]
  - @voyantjs/finance@0.33.0
  - @voyantjs/finance-react@0.33.0
  - @voyantjs/i18n@0.33.0
  - @voyantjs/ui@0.33.0

## 0.32.3

### Patch Changes

- Updated dependencies [7632a66]
  - @voyantjs/finance@0.32.3
  - @voyantjs/finance-react@0.32.3
  - @voyantjs/i18n@0.32.3
  - @voyantjs/ui@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/finance@0.32.2
- @voyantjs/finance-react@0.32.2
- @voyantjs/i18n@0.32.2
- @voyantjs/ui@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/finance@0.32.1
- @voyantjs/finance-react@0.32.1
- @voyantjs/i18n@0.32.1
- @voyantjs/ui@0.32.1

## 0.32.0

### Patch Changes

- Updated dependencies [6ea6ded]
  - @voyantjs/finance@0.32.0
  - @voyantjs/finance-react@0.32.0
  - @voyantjs/i18n@0.32.0
  - @voyantjs/ui@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/finance@0.31.4
- @voyantjs/finance-react@0.31.4
- @voyantjs/i18n@0.31.4
- @voyantjs/ui@0.31.4

## 0.31.3

### Patch Changes

- 5f974dd: Add first-class invoice attachment persistence, admin routes, React hooks, and invoice detail UI.
- Updated dependencies [5f974dd]
  - @voyantjs/finance@0.31.3
  - @voyantjs/finance-react@0.31.3
  - @voyantjs/i18n@0.31.3
  - @voyantjs/ui@0.31.3

## 0.31.2

### Patch Changes

- Updated dependencies [54ddc93]
  - @voyantjs/finance@0.31.2
  - @voyantjs/finance-react@0.31.2
  - @voyantjs/i18n@0.31.2
  - @voyantjs/ui@0.31.2

## 0.31.1

### Patch Changes

- Updated dependencies [00f7c4f]
  - @voyantjs/finance@0.31.1
  - @voyantjs/finance-react@0.31.1
  - @voyantjs/i18n@0.31.1
  - @voyantjs/ui@0.31.1

## 0.31.0

### Minor Changes

- ee75afb: Publish the invoices page composition and loading skeleton from finance UI.
- ee75afb: Publish the payments page composition and loading skeleton from finance UI.
- ee75afb: Publish reusable TaxesPage and TeamSettingsPage settings compositions from their owning UI packages.

### Patch Changes

- ee75afb: Publish the finance invoice detail page composition with summary, links, line items, payments, credit notes, notes, and editable header actions.
- ee75afb: Publish the payment detail page composition with summary, related-record, and metadata cards.
  - @voyantjs/finance@0.31.0
  - @voyantjs/finance-react@0.31.0
  - @voyantjs/i18n@0.31.0
  - @voyantjs/ui@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/finance@0.30.7
- @voyantjs/finance-react@0.30.7
- @voyantjs/i18n@0.30.7
- @voyantjs/ui@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/finance@0.30.6
- @voyantjs/finance-react@0.30.6
- @voyantjs/i18n@0.30.6
- @voyantjs/ui@0.30.6

## 0.30.5

### Patch Changes

- @voyantjs/finance@0.30.5
- @voyantjs/finance-react@0.30.5
- @voyantjs/i18n@0.30.5
- @voyantjs/ui@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/finance@0.30.4
- @voyantjs/finance-react@0.30.4
- @voyantjs/i18n@0.30.4
- @voyantjs/ui@0.30.4

## 0.30.3

### Patch Changes

- @voyantjs/finance@0.30.3
- @voyantjs/finance-react@0.30.3
- @voyantjs/i18n@0.30.3
- @voyantjs/ui@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/finance@0.30.2
- @voyantjs/finance-react@0.30.2
- @voyantjs/i18n@0.30.2
- @voyantjs/ui@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/finance@0.30.1
- @voyantjs/finance-react@0.30.1
- @voyantjs/i18n@0.30.1
- @voyantjs/ui@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/finance@0.30.0
- @voyantjs/finance-react@0.30.0
- @voyantjs/i18n@0.30.0
- @voyantjs/ui@0.30.0

## 0.29.0

### Patch Changes

- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
- Updated dependencies [4a6523e]
  - @voyantjs/finance@0.29.0
  - @voyantjs/finance-react@0.29.0
  - @voyantjs/i18n@0.29.0
  - @voyantjs/ui@0.29.0

## 0.28.3

### Patch Changes

- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
- Updated dependencies [60ef432]
  - @voyantjs/finance@0.28.3
  - @voyantjs/finance-react@0.28.3
  - @voyantjs/i18n@0.28.3
  - @voyantjs/ui@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/finance@0.28.2
- @voyantjs/finance-react@0.28.2
- @voyantjs/i18n@0.28.2
- @voyantjs/ui@0.28.2

## 0.28.1

### Patch Changes

- Updated dependencies [9d88eae]
  - @voyantjs/finance@0.28.1
  - @voyantjs/finance-react@0.28.1
  - @voyantjs/i18n@0.28.1
  - @voyantjs/ui@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/finance@0.28.0
- @voyantjs/finance-react@0.28.0
- @voyantjs/i18n@0.28.0
- @voyantjs/ui@0.28.0

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/finance@0.27.0
  - @voyantjs/finance-react@0.27.0
  - @voyantjs/i18n@0.27.0
  - @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/finance@0.26.9
  - @voyantjs/finance-react@0.26.9
  - @voyantjs/i18n@0.26.9
  - @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/finance@0.26.8
- @voyantjs/finance-react@0.26.8
- @voyantjs/i18n@0.26.8
- @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/finance@0.26.7
- @voyantjs/finance-react@0.26.7
- @voyantjs/i18n@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- Updated dependencies [571e340]
  - @voyantjs/finance@0.26.6
  - @voyantjs/finance-react@0.26.6
  - @voyantjs/i18n@0.26.6
  - @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/finance@0.26.5
- @voyantjs/finance-react@0.26.5
- @voyantjs/i18n@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/finance@0.26.4
- @voyantjs/finance-react@0.26.4
- @voyantjs/i18n@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/finance@0.26.3
- @voyantjs/finance-react@0.26.3
- @voyantjs/i18n@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/finance@0.26.2
- @voyantjs/finance-react@0.26.2
- @voyantjs/i18n@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/finance@0.26.1
- @voyantjs/finance-react@0.26.1
- @voyantjs/i18n@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/finance@0.26.0
- @voyantjs/finance-react@0.26.0
- @voyantjs/i18n@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/finance@0.25.0
- @voyantjs/finance-react@0.25.0
- @voyantjs/i18n@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/finance@0.24.3
- @voyantjs/finance-react@0.24.3
- @voyantjs/i18n@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/finance@0.24.2
- @voyantjs/finance-react@0.24.2
- @voyantjs/i18n@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
  - @voyantjs/finance@0.24.1
  - @voyantjs/finance-react@0.24.1
  - @voyantjs/i18n@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/finance@0.24.0
- @voyantjs/finance-react@0.24.0
- @voyantjs/i18n@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/finance@0.23.0
- @voyantjs/finance-react@0.23.0
- @voyantjs/i18n@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/finance@0.22.0
- @voyantjs/finance-react@0.22.0
- @voyantjs/i18n@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/finance@0.21.1
- @voyantjs/finance-react@0.21.1
- @voyantjs/i18n@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/finance@0.21.0
  - @voyantjs/finance-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- Updated dependencies [cc3eddd]
  - @voyantjs/finance-react@0.20.0
  - @voyantjs/i18n@0.20.0
  - @voyantjs/ui@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/finance-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/finance-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/finance-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/finance-react@0.16.0
- @voyantjs/ui@0.16.0

## 0.15.0

### Minor Changes

- cccc905: Bulk-extract per-domain importable UI packages, mirroring the `*-react` split. 17 new `*-ui` packages shipping a combined 137 components; primitives package `voyant-ui` gains 3 promoted shared primitives (`currency-combobox`, `date-time-picker`, `country-combobox`).

  **New `*-ui` packages**: `booking-requirements`, `bookings`, `charters`, `cruises`, `distribution`, `external-refs`, `extras`, `finance`, `hospitality`, `identity`, `legal`, `markets`, `pricing`, `products`, `resources`, `sellability`, `suppliers`. (Already shipped in prior commit: `crm-ui`.)

  **`voyant-ui` additions**: `CurrencyCombobox`, `DateTimePicker`, `CountryCombobox` — promoted from registry/template-local sources because they're shared primitives that 21 domain components depend on. Adds `@voyantjs/utils` to dependencies.

  **Two distribution modes for every domain**:

  - Importable: `pnpm add @voyantjs/<domain>-ui` — version-tracked, updates flow with bumps
  - Registry: `npx shadcn add @voyant/<component>` — copy + own, fork-friendly

  **Components NOT in importable packages** (registry-only):

  - Router-coupled components (TanStack Router): legal `quotes-page`, `create-quote-dialog`, etc.
  - Template-local-helper-coupled: `@/components/voyant/crm/*` deps, `@/lib/api-client` deps
  - Components with pre-existing latent bugs surfaced by per-package compilation: API drift against `*-react` hooks (e.g., `useBookingItemParticipants` no longer exists), loose typing that worked under permissive consumer tsconfigs but not under strict library compilation, broken imports to skipped sibling components

  The full coupling-and-bug list is preserved in each package's README. These components remain consumable via the shadcn registry path; they can be promoted into the importable packages when their underlying issues are fixed.

  **Domains with no importable surface** (all components either failed to compile or were registry-only by design): `auth`, `ground`, `notifications`, `transactions`. Their components remain available via the registry.

  **Tree-shaking**: `sideEffects: false` is set across all packages. With ESM + Bundler-resolution, modern bundlers (Vite, webpack, Next.js) drop unused named exports through barrels.

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/finance-react@0.15.0
  - @voyantjs/ui@0.15.0

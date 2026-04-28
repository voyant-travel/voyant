# @voyantjs/legal-react

## 0.14.0

### Patch Changes

- @voyantjs/legal@0.14.0
- @voyantjs/react@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/legal@0.13.0
- @voyantjs/react@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/legal@0.12.0
- @voyantjs/react@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/legal@0.11.0
- @voyantjs/react@0.11.0

## 0.10.0

### Patch Changes

- Updated dependencies [29a581a]
  - @voyantjs/legal@0.10.0
  - @voyantjs/react@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/legal@0.9.0
- @voyantjs/react@0.9.0

## 0.8.0

### Minor Changes

- 24dc253: End-to-end contract generation workflow for the operator template. Four-PR batch riding together on the fixed train:

  **Template renderer filters (#270)** — Three new Liquid filters registered on `@voyantjs/utils`' shared template engine: `currency`, `cents` (integer cents → currency string), `format_date` with short/medium/long/iso presets. Picked up automatically by `renderStructuredTemplate` consumers (`@voyantjs/legal`, `@voyantjs/notifications`).

  **Auto-generate on booking.confirmed (#271)** — `createLegalHonoModule` now accepts `autoGenerateContractOnConfirmed`: an opt-in subscriber that, on every `booking.confirmed` event, creates a contract against the configured template slug, renders its Liquid body with booking + traveler variables, and delegates to the configured PDF generator. Discriminated outcome (`template_not_found` / `template_version_missing` / `booking_not_found` / `contract_create_failed` / `document_failed` / `ok`) surfaces misconfigs at bootstrap. New `findTemplateBySlug` + `findSeriesByName` helpers on the template/series services. `@voyantjs/legal` now depends on `@voyantjs/bookings` (no cycle).

  **Booking contract card hook plumbing (#272)** — `@voyantjs/legal-react` gains `generateDocument` + `regenerateDocument` mutations on `useLegalContractMutation`, `LegalContractsListFilters` now carries `bookingId` / `personId` / `organizationId` (already server-side-supported), new `legalContractGenerateDocumentResponse` schema. Paired registry component `voyant-legal-booking-contract-card` lists contracts for a booking with download + regenerate actions.

  **Operator wiring (#273)** — Operator template now resolves a PDF document generator from the `DOCUMENTS_BUCKET` R2 binding, enables `autoGenerateContractOnConfirmed` against slug `customer-sales-agreement`, and its seed script now writes a proper Liquid-templated contract body + a `contract_template_versions` row so the auto-generate flow resolves end-to-end from first confirm.

### Patch Changes

- Updated dependencies [24dc253]
  - @voyantjs/legal@0.8.0
  - @voyantjs/react@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/legal@0.7.0
- @voyantjs/react@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/legal@0.6.9
- @voyantjs/react@0.6.9

## 0.6.8

### Patch Changes

- Updated dependencies [b218885]
- Updated dependencies [b218885]
  - @voyantjs/legal@0.6.8
  - @voyantjs/react@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/legal@0.6.7
- @voyantjs/react@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/legal@0.6.6
- @voyantjs/react@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/legal@0.6.5
- @voyantjs/react@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/legal@0.6.4
- @voyantjs/react@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/legal@0.6.3
- @voyantjs/react@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/legal@0.6.2
- @voyantjs/react@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/legal@0.6.1
- @voyantjs/react@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/legal@0.6.0
- @voyantjs/react@0.6.0

## 0.5.0

### Minor Changes

- ce72e29: Flesh out the operator booking workspace with React hooks for the sections that already existed on the backend.

  - `@voyantjs/bookings-react`: add hooks for booking items (`useBookingItems`, `useBookingItemMutation`), item-traveler assignment (`useBookingItemTravelers`, `useBookingItemTravelerMutation`), documents (`useBookingDocuments`, `useBookingDocumentMutation`), cancellation (`useBookingCancelMutation`), and convert-from-product (`useBookingConvertMutation`).
  - `@voyantjs/finance-react`: add hooks for booking payment schedules (`useBookingPaymentSchedules`, `useBookingPaymentScheduleMutation`) and booking guarantees (`useBookingGuarantees`, `useBookingGuaranteeMutation`).
  - `@voyantjs/legal-react`: add policy resolution (`useResolvePolicy`) and cancellation evaluation (`useEvaluateCancellation`) hooks that power the structured booking cancellation workflow.

### Patch Changes

- @voyantjs/legal@0.5.0
- @voyantjs/react@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/legal@0.4.5
  - @voyantjs/react@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/legal@0.4.4
- @voyantjs/react@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/legal@0.4.3
- @voyantjs/react@0.4.3

## 0.4.2

### Patch Changes

- Updated dependencies [8de4602]
  - @voyantjs/legal@0.4.2
  - @voyantjs/react@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/legal@0.4.1
- @voyantjs/react@0.4.1

## 0.4.0

### Patch Changes

- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
- Updated dependencies [e84fe0f]
  - @voyantjs/legal@0.4.0
  - @voyantjs/react@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [8566f2d]
  - @voyantjs/legal@0.3.1
  - @voyantjs/react@0.3.1

## 0.3.0

### Patch Changes

- Updated dependencies [e57725d]
  - @voyantjs/legal@0.3.0
  - @voyantjs/react@0.3.0

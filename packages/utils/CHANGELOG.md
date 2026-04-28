# @voyantjs/utils

## 0.14.0

### Patch Changes

- @voyantjs/types@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/types@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/types@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/types@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/types@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/types@0.9.0

## 0.8.0

### Minor Changes

- 24dc253: End-to-end contract generation workflow for the operator template. Four-PR batch riding together on the fixed train:

  **Template renderer filters (#270)** — Three new Liquid filters registered on `@voyantjs/utils`' shared template engine: `currency`, `cents` (integer cents → currency string), `format_date` with short/medium/long/iso presets. Picked up automatically by `renderStructuredTemplate` consumers (`@voyantjs/legal`, `@voyantjs/notifications`).

  **Auto-generate on booking.confirmed (#271)** — `createLegalHonoModule` now accepts `autoGenerateContractOnConfirmed`: an opt-in subscriber that, on every `booking.confirmed` event, creates a contract against the configured template slug, renders its Liquid body with booking + traveler variables, and delegates to the configured PDF generator. Discriminated outcome (`template_not_found` / `template_version_missing` / `booking_not_found` / `contract_create_failed` / `document_failed` / `ok`) surfaces misconfigs at bootstrap. New `findTemplateBySlug` + `findSeriesByName` helpers on the template/series services. `@voyantjs/legal` now depends on `@voyantjs/bookings` (no cycle).

  **Booking contract card hook plumbing (#272)** — `@voyantjs/legal-react` gains `generateDocument` + `regenerateDocument` mutations on `useLegalContractMutation`, `LegalContractsListFilters` now carries `bookingId` / `personId` / `organizationId` (already server-side-supported), new `legalContractGenerateDocumentResponse` schema. Paired registry component `voyant-legal-booking-contract-card` lists contracts for a booking with download + regenerate actions.

  **Operator wiring (#273)** — Operator template now resolves a PDF document generator from the `DOCUMENTS_BUCKET` R2 binding, enables `autoGenerateContractOnConfirmed` against slug `customer-sales-agreement`, and its seed script now writes a proper Liquid-templated contract body + a `contract_template_versions` row so the auto-generate flow resolves end-to-end from first confirm.

### Patch Changes

- @voyantjs/types@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/types@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/types@0.6.9

## 0.6.8

### Patch Changes

- @voyantjs/types@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/types@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/types@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/types@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/types@0.6.4

## 0.6.3

### Patch Changes

- @voyantjs/types@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/types@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/types@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/types@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/types@0.5.0

## 0.4.5

### Patch Changes

- @voyantjs/types@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/types@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/types@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/types@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/types@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add built-in PDF document adapters for legal and finance workflows.

  `@voyantjs/utils` now exports `renderPdfDocument()` as a shared basic PDF
  renderer for rendered text content. `@voyantjs/legal` and `@voyantjs/finance`
  now expose bundled PDF serializers and generator helpers on top of their
  storage-backed document workflows, so apps can generate readable PDF artifacts
  without wiring a custom browser renderer for the common case.

- e84fe0f: Upgrade legal and finance template rendering to support Liquid-style control
  flow.

  - add a shared structured template renderer in `@voyantjs/utils`
  - keep simple `{{path}}` interpolation compatibility for existing templates
  - support Liquid loops, conditionals, and filters in legal and finance
    html/markdown templates
  - support Liquid rendering inside lexical text nodes for legal and finance
    template bodies
  - @voyantjs/types@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/types@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/types@0.3.0

## 0.2.0

### Patch Changes

- @voyantjs/types@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/types@0.1.1

## 1.1.11

### Patch Changes

- @voyantjs/types@1.1.11

## 1.1.1

### Patch Changes

- @voyantjs/types@1.1.1

## 1.1.0

### Minor Changes

- [#292](https://github.com/voyantjs/voyant/pull/292)
  [`d799492`](https://github.com/voyantjs/voyant/commit/d799492fabc7789315d614af4bb2f3a58804ce10)
  Thanks [@mihaipxm](https://github.com/mihaipxm)! - Initial SDK release

### Patch Changes

- Updated dependencies
  [[`d799492`](https://github.com/voyantjs/voyant/commit/d799492fabc7789315d614af4bb2f3a58804ce10)]:
  - @voyantjs/types@1.1.0

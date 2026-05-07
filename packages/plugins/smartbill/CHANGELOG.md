# @voyantjs/plugin-smartbill

## 0.26.7

### Patch Changes

- 947bdfc: Make `@voyantjs/plugin-smartbill/mock` return live-compatible SmartBill response envelopes by default, so a third-party SmartBill SDK can now point at the local mock as a sandbox (closes #436).

  Mock changes:

  - `GET /tax`, `GET /series`, `POST /invoice`, `POST /estimate`, `PUT /invoice/cancel|restore|reverse`, `DELETE /invoice`, `GET /invoice/paymentstatus`, `GET /estimate/invoices` now wrap their bodies in the live envelope shape (`status: "Ok" | "Error"`, `message`, `errorText`, plus payload fields). Errors emit `{ status: "Error", errorText, message }`.
  - `GET /series` returns the live single-letter `type` codes (`"f"` for invoice / factură, `"p"` for proforma).
  - `GET /invoice/paymentstatus` returns the live `paid: boolean` plus `invoiceTotalAmount` and a `payments` list (currently one entry per payment supplied at create time).
  - `GET /estimate/invoices` returns `areInvoicesCreated`, `series`, and `number` of the latest converted invoice.
  - `GET /invoice/pdf` and `GET /estimate/pdf` now return raw PDF bytes with `Content-Type: application/pdf`. The synthetic mock URL stays available via the `X-Mock-Pdf-Url` response header.

  Client changes (in-tree `createSmartbillClient`, breaking shape but private to this package — no other workspace package consumes the old shape):

  - `viewPdf` now returns `{ bytes: Uint8Array; contentType: string }`. Added `viewInvoicePdf` (same behaviour) and a new `viewEstimatePdf` for proforma PDFs. `viewPdf` is kept as an alias for `viewInvoicePdf`.
  - `getPaymentStatus` now returns the live envelope (`paid: boolean`, `invoiceTotalAmount`, `paidAmount`, `unpaidAmount`, `payments`, `status`, `message`, `errorText`). Callers should read `paid` instead of comparing `status === "paid"`. The settlement poller has been updated accordingly.
  - New methods: `restoreInvoice`, `listTaxes`, `listSeries`, `listEstimateInvoices`.
  - The client now treats any envelope with `status === "Error"` or a non-empty `errorText` as a thrown error, matching live SmartBill behaviour.

  `SmartbillFetch` is extended with `arrayBuffer()` and an optional `headers.get(name)` accessor — purely additive on top of the existing `fetch`-shape. New exported types: `SmartbillEnvelope`, `SmartbillTaxesResponse`, `SmartbillSeriesResponse`, `SmartbillEstimateInvoicesResponse`, `SmartbillPaymentEntry`.

  - @voyantjs/core@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/core@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/core@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/core@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/core@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/core@0.26.1

## 0.26.0

### Minor Changes

- 03d64ea: Add a supported local SmartBill mock for safe development and end-to-end billing tests.

  The new `@voyantjs/plugin-smartbill/mock` entrypoint exposes a stateful
  SmartBill-compatible mock with in-process `fetch`, a localhost HTTP listener,
  deterministic document numbering, PDF URLs marked as test documents, invoice
  status changes, and proforma conversion polling.

### Patch Changes

- @voyantjs/core@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/core@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/core@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/core@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/core@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/core@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/core@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/core@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/core@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/core@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/core@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/core@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/core@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/core@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/core@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/core@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/core@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/core@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/core@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/core@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/core@0.6.9

## 0.6.8

### Patch Changes

- @voyantjs/core@0.6.8

## 0.6.7

### Patch Changes

- @voyantjs/core@0.6.7

## 0.6.6

### Patch Changes

- @voyantjs/core@0.6.6

## 0.6.5

### Patch Changes

- @voyantjs/core@0.6.5

## 0.6.4

### Patch Changes

- @voyantjs/core@0.6.4

## 0.6.3

### Patch Changes

- Updated dependencies [d3c6937]
  - @voyantjs/core@0.6.3

## 0.6.2

### Patch Changes

- @voyantjs/core@0.6.2

## 0.6.1

### Patch Changes

- @voyantjs/core@0.6.1

## 0.6.0

### Patch Changes

- @voyantjs/core@0.6.0

## 0.5.0

### Patch Changes

- @voyantjs/core@0.5.0

## 0.4.5

### Patch Changes

- Updated dependencies [e3f6e72]
  - @voyantjs/core@0.4.5

## 0.4.4

### Patch Changes

- @voyantjs/core@0.4.4

## 0.4.3

### Patch Changes

- @voyantjs/core@0.4.3

## 0.4.2

### Patch Changes

- @voyantjs/core@0.4.2

## 0.4.1

### Patch Changes

- @voyantjs/core@0.4.1

## 0.4.0

### Patch Changes

- e84fe0f: Add first-class invoice settlement polling and reconciliation.

  - add `POST /v1/admin/finance/invoices/:id/poll-settlement` with typed polling
    and reconciliation results
  - sync provider settlement state back onto `invoice_external_refs`
  - reconcile newly observed paid amounts into completed Voyant payments without
    over-applying across multiple provider refs
  - add `createSmartbillInvoiceSettlementPoller()` in
    `@voyantjs/plugin-smartbill`
  - @voyantjs/core@0.4.0

## 0.3.1

### Patch Changes

- @voyantjs/core@0.3.1

## 0.3.0

### Patch Changes

- @voyantjs/core@0.3.0

## 0.2.0

### Patch Changes

- 99c6dac: Fix the published package layout so plugin build output lands at `dist/*` without leaking `dist/src/*` or compiled tests into npm tarballs.
  - @voyantjs/core@0.2.0

## 0.1.1

### Patch Changes

- @voyantjs/core@0.1.1

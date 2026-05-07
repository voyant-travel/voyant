---
"@voyantjs/plugin-smartbill": patch
---

Make `@voyantjs/plugin-smartbill/mock` return live-compatible SmartBill response envelopes by default, so a third-party SmartBill SDK can now point at the local mock as a sandbox (closes #436).

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

# Invoice Rendition Wait Contract

Interactive invoice callers may request a short bounded wait for a generated
document by passing `wait: "pdf"` or `wait=true` on supported invoice routes.
The wait is additive: omitted or `wait: "none"` preserves the historical
response shape.

Supported surfaces:

- `POST /v1/admin/finance/invoices/from-booking`
- `POST /v1/admin/finance/invoices/:id/render`
- `POST /v1/admin/finance/invoices/:id/generate-document` and
  `/regenerate-document` attach a `download` envelope when the generated
  rendition already has a resolvable URL.

Waits are capped at 60 seconds and default to 30 seconds. Routes poll
`invoice_renditions` for the target invoice and requested format until a
terminal `ready` or `failed` rendition exists. A ready rendition returns an
inline `download` envelope when the deployment has a document URL resolver or
the rendition metadata carries a URL. Timeout, failed, or not-downloadable
renditions return `202 Accepted` with the invoice/rendition metadata so callers
can continue with the regular rendition download or polling flow.

Routes must use the shared `waitForInvoiceRendition(...)` helper and
`resolveStoredDocumentDownload(...)` rather than implementing custom polling or
metadata URL parsing.

See `docs/architecture/document-download-envelopes.md` for the shared download
envelope contract used by invoice renditions, finance attachments, and legal
contract attachments.

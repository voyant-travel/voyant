# Invoice Number Allocation

Finance routes that issue invoice-like documents use the same precedence rules
for document numbers:

1. A caller-supplied `invoiceNumber` wins. The server stores it as-is and does
   not advance a sequence.
2. If `invoiceNumber` is omitted and `seriesId` is supplied, the server uses
   that series. The series must be active and must match the requested scope:
   `invoice` for invoices, `proforma` for proformas.
3. If both are omitted, the server resolves the active default series for the
   requested scope. If no active default exists, it falls back to the most
   recently updated active series for that scope.
4. If no active series exists for the scope, the issuing route returns `409`
   with `error: "no_active_series_for_scope"`.

Local series allocation uses `financeService.allocateInvoiceNumber(...)`, which
row-locks the series while advancing `currentSequence`.

Series with `externalProvider` set do not advance local sequences. They create
the local invoice with a unique `PENDING-...` placeholder and
`status: "pending_external_allocation"`, then emit the normal issued event with
`externalAllocationRequired: true`. The provider adapter creates the external
document, receives the provider-owned number, and patches the local invoice via
`financeService.applyExternalInvoiceAllocation(...)`.

Only one active default series is allowed per scope.

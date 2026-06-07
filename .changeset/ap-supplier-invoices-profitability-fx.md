---
"@voyantjs/finance": patch
"@voyantjs/finance-contracts": patch
"@voyantjs/finance-react": patch
"@voyantjs/finance-ui": patch
"@voyantjs/availability": patch
"@voyantjs/bookings": patch
"@voyantjs/suppliers": patch
"@voyantjs/schema-kit": patch
"@voyantjs/admin": patch
"@voyantjs/i18n": patch
"@voyantjs/ui": patch
---

feat(finance): accounts-payable supplier invoices, profitability & end-to-end FX

Adds the full accounts-payable vertical for #1506:

- **Supplier invoices (AP)**: `supplier_invoices` / `supplier_invoice_lines` /
  `supplier_cost_allocations`, the `supplierInvoicesService` (create/update/
  setLines/setAllocations/payments), attachments, and admin API routes.
- **Cost allocation**: two-step product → departure picker, configurable cost
  categories (managed under Settings), searchable comboboxes.
- **Profitability**: per-departure / per-product / per-traveller P&L read model
  + dashboards, cost-by-category breakdown, charts, CSV export.
- **Accountant share portal**: scoped, revocable token links (no login) exposing
  financials + client/supplier invoices with downloadable attachments, ZIP
  download, and an en/ro language switcher.
- **End-to-end FX**: supplier invoices and cost allocations snapshot their
  accounting-base value at the FX rate effective on the issue date; the
  profitability rollup sums those recorded snapshots (per-transaction-date
  rates) instead of re-valuing aggregates at the latest rate.

Supporting additive exports: `availability`/`bookings`/`suppliers` schema and
linkable exports consumed by the finance read model, and new TypeID prefixes in
`schema-kit`.

---
"@voyantjs/finance": patch
"@voyantjs/finance-react": patch
"@voyantjs/admin": patch
"@voyantjs/i18n": patch
---

Add a unified payments listing that joins customer and supplier payments into a single feed, and split the operator finance area into separate Invoices and Payments pages.

`@voyantjs/finance`:

- New routes `GET /v1/admin/finance/payments` and `GET /v1/admin/finance/payments/:id`. The list endpoint accepts a `kind` filter (`customer` | `supplier`) plus the usual `status` / `paymentMethod` / `currency` / `invoiceId` / `bookingId` / `supplierId` / `paymentDateFrom` / `paymentDateTo` / `search` filters and `sortBy` (`amountCents` | `status` | `paymentDate` | `createdAt`) / `sortDir`. The detail endpoint dispatches by typeid prefix — `pay_*` resolves to a customer payment, `spay_*` resolves to a supplier payment.
- `financeService.listAllPayments(db, query)` and `financeService.getPaymentById(db, id)` return a `UnifiedPaymentRow` shape with normalized fields (`personName`, `organizationName`, `supplierName`, `invoiceNumber`, `bookingNumber`) joined in via SQL so the operator UI doesn't need follow-up lookups.
- New exports: `UnifiedPaymentRow` (service.ts) and `paymentKindSchema` / `paymentListQuerySchema` / `paymentListSortFieldSchema` / `paymentListSortDirSchema` (validation-payments.ts).

`@voyantjs/finance-react`:

- New hooks: `useAllPayments(filters)` and `usePayment(id)` plus the underlying `getAllPaymentsQueryOptions` / `getPaymentQueryOptions` query-options factories.
- New types: `FinancePaymentKind`, `FinanceAllPaymentsListFilters`, `FinanceAllPaymentsListSortField`, `FinanceAllPaymentsListSortDir`.
- New schemas: `paymentKindSchema`, `unifiedPaymentRecordSchema`, `allPaymentsListResponse`, `paymentSingleResponse`, plus matching `UnifiedPaymentRecord` type.
- New invoice-payment-mutation invalidation now also invalidates `financeQueryKeys.allPayments()` so the unified feed stays in sync with single-invoice payment flows.

`@voyantjs/admin`:

- Operator nav `finance` entry now points at `/finance/invoices` and exposes an `items` sub-nav with `invoices` and `payments` links, matching the new operator page split.

`@voyantjs/i18n`:

- Operator nav messages add `invoices` and `payments` (en + ro).
- Admin finance messages add `invoicesPageTitle`/`invoicesPageDescription`, `paymentsPageTitle`/`paymentsPageDescription`, `recordPayment`, `searchPaymentsPlaceholder`, `kindColumn`/`kindCustomer`/`kindSupplier`/`partyColumn`/`filtersKindLabel`/`filtersKindAll`, plus the `paymentDetail` and `recordPaymentDialog` message groups (en + ro).

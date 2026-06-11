---
"@voyantjs/suppliers-ui": minor
"@voyantjs/finance-ui": minor
---

Packaged-admin RFC suppliers pages delivered: the operator's supplier
wrappers move into `@voyantjs/suppliers-ui/admin` as packaged hosts —
`SuppliersHost` (zero-prop list host, attachable directly as a route
`component:`), `SupplierDetailHost`, and the matching
`SuppliersListSkeleton` / `SupplierDetailSkeleton` route placeholders.
Cross-route links resolve through the semantic destination keys (RFC §4.7)
via `useAdminNavigate` — new key `supplier.list`, plus shape-locked
`supplier.detail` (also declared by catalog-ui and finance-ui).
`createSuppliersAdminExtension` contributes the suppliers route metadata
(no nav — the Suppliers item is base-nav-owned; no search contracts — the
list keeps its filters local). The extension seam also resolves the
finance-ui ↔ suppliers-ui cycle: the supplier detail page's
customer-payment-policy card now ships from `@voyantjs/finance-ui/admin` as
the `SupplierPaymentPolicyWidget` contribution targeting the new
`supplier.details.payment-policy` slot (`supplierDetailPaymentPolicySlot`).
`SupplierDetailHost` renders the section whenever a widget contribution
targets that slot and hands widgets the typed
`SupplierDetailHostSlotContext` (`{ supplier, updateSupplier, isUpdating }`)
as props; the card's strings move into finance-ui's i18n
(`paymentPolicy.supplierCard`, en + ro). Host route files shrink to param
binding + SSR prefetch; `component:` stays off the route contributions
until the §4.2 code-based route assembly lands. New suppliers-ui peer:
`@voyantjs/admin`. New finance-ui peer: `sonner`.

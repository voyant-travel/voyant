---
"@voyantjs/suppliers-ui": patch
"@voyantjs/promotions-ui": patch
"@voyantjs/flights-ui": patch
---

UI polish across supplier, promotion, and flights surfaces.

- `SuppliersPage` rebuilt around the shared table primitives with consistent sort/filter/empty-state behaviour. `SupplierDialog` and `RateDialog` get the same form pattern as the rest of the admin dialogs, including new i18n strings (EN + RO).
- `PromotionsPage` moves filter controls into a `Popover` driven by a single "Filters" trigger so the toolbar no longer overflows on narrow viewports; new i18n string for the trigger label (EN + RO).
- `BillingPersonPicker` / `BillingOrgPicker` follow the CRM `birthday → dateOfBirth` rename so the adult-only filter keeps working.

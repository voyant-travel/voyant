---
"@voyantjs/bookings-ui": minor
"@voyantjs/catalog": minor
"@voyantjs/catalog-contracts": minor
"@voyantjs/products": minor
"@voyantjs/i18n": minor
---

Admin booking journey overhaul + unified new-booking + reusable catalog UI (#1625)

- **bookings-ui**: the operator books on a single stacked, guided accordion (progressive unlock, auto-advance) instead of the wizard; storefront keeps the wizard. Travelers as add-rows + per-traveler type + CRM linking, Configure with departure-first + nested rooms + occupancy-dependency rules, price override + voucher in the side panel, single payment-link checkbox, notes/docs block, save-as-draft / confirmed-if-paid status, duplicate-departure warning, commit lands on the booking detail. Journey steps split into per-step modules. B2B billing is satisfied by a picked organization; switching the product option clears stale room selections.
- **catalog / catalog-react / catalog-ui**: the operator catalog browse/detail UI moves into the shared `@voyantjs/catalog-ui` + `@voyantjs/catalog-react` packages (detail pages, browse/dynamic/scheduled, gallery, calendar, sheet, enrichment, catalog i18n) so other templates can reuse them; booking-engine commit path returns the booking id and lands on detail.
- **catalog-contracts**: adds pax-band occupancy dependencies, the option-units configure sub-step, and the sourced stays/package rate pin (`roomTypeId` / `ratePlanId` / `board`) to the booking-engine draft + adapter contracts.
- **products / i18n**: products booking handler forwards the slot id + breakdown currency; admin booking-journey i18n strings.

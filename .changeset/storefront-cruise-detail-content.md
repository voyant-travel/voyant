---
"@voyant-travel/storefront-react": patch
---

Stop the storefront customer surface from linking to cruise detail pages that
cannot render. The public cruise content endpoint serves sourced cruises only
(no owned-cruise content projector), so owned/demo cruises surfaced by catalog
search linked to a detail page that 404s or 400s. Cruises are removed from
`storefrontCustomerBookableProductVerticals` so search and the customer detail
route no longer offer them, mirroring the charter/flight gating from
voyant#2640. Cruises remain fully searchable and admin-manageable; re-add the
vertical once owned cruises can render public content end-to-end.

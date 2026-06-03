---
"@voyantjs/products-ui": minor
"@voyantjs/products": minor
"@voyantjs/availability": minor
"@voyantjs/availability-react": minor
"@voyantjs/allocation-ui": minor
"@voyantjs/i18n": minor
---

Redesign the operator's **Booking options & prices** for low-tech travel agents and close the inventory/allocation gaps it exposed.

- `@voyantjs/products-ui`: each option now renders **one adaptive table** — a rooms grid (rooms × traveler types) or a per-person seats list — derived from the product's inventory (rooms always win over booking mode). The rate-plan layer is hidden behind an **Advanced** disclosure (a single default plan is auto-managed); the default plan's matrix is no longer duplicated there. Single-option products show the table directly with no chrome. The unit form pins its type in the contextual add ("Add room" can't create a vehicle) and uses type-aware quantity/occupancy labels; the price dialog uses the design-system currency input and pricing-mode-aware quantity labels. New departures pre-fill **Capacity (pax)** from the configured inventory (overridable).
- `@voyantjs/products`: `createProduct` seeds a default `Standard` option so new products open straight into the pricing table; the day-translation create route now verifies the day belongs to the product.
- `@voyantjs/availability` + `@voyantjs/availability-react`: departure inventory templates can be **generated from the option's rooms** and **applied to existing open departures** (new bulk endpoint + hook). The full-inventory materializer now works for product-level departures (no `optionId`), so auto-seed on publish and bulk apply create the full room set. New per-slot `materialize-templates` endpoint.
- `@voyantjs/allocation-ui`: a slot's **Generate resources** now materializes the full configured inventory across all kinds in one click, instead of the pax-derived single-kind path.

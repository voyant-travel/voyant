---
"@voyantjs/crm-ui": minor
"@voyantjs/bookings-ui": minor
---

Packaged-admin RFC CRM pages delivered: the operator's people/organization
wrappers move into `@voyantjs/crm-ui/admin` as packaged hosts — zero-prop
`PeopleHost` / `OrganizationsHost` (route files mount them directly via
`component:`), `PersonDetailHost`, `OrganizationDetailHost` (canonical CRM
pages bound to semantic-destination navigation, with admin chrome
breadcrumbs on the organization page), and the four matching skeletons.
Cross-route links resolve through the semantic destination keys (RFC §4.7)
via `useAdminHref`/`useAdminNavigate` — new keys `person.list` and
`organization.list`, plus shape-locked `person.detail` and
`organization.detail` (also declared by `@voyantjs/bookings-ui/admin`;
crm-ui cannot peer-depend on bookings-ui, so the keys are re-declared with
identical shapes). `createCrmAdminExtension` contributes the CRM route
metadata (no nav — People/Organizations are base-nav-owned, and no search
contracts — the lists keep filter state in memory) AND resolves the
crm-ui ↔ bookings-ui cycle: the person detail page's Bookings tab now ships
as the `PersonBookingsWidget` contribution from `@voyantjs/bookings-ui`
targeting the new `person.details.bookings-tab` slot. `@voyantjs/crm-ui`'s
`PersonDetailHost` exposes that slot (`personDetailBookingsTabSlot`), mounts
its Bookings tab whenever a widget contribution targets it, and hands
widgets the typed `PersonDetailBookingsTabContext` (`{ personId }`) as
props. Host route files shrink to param binding; `component:` stays off the
route contributions until the §4.2 code-based route assembly lands. New
crm-ui peer: `@voyantjs/admin`.

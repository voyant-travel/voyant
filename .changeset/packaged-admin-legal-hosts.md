---
"@voyantjs/legal-ui": minor
---

Packaged-admin RFC legal pages delivered: the operator's legal wrappers move
into `@voyantjs/legal-ui/admin` as packaged hosts — `ContractsHost` /
`ContractDetailHost` (operator-grade contracts pages with the CRM/supplier/
channel-bound `ContractDialog`, person name cells, reference resolution for
person/booking/template-version/number-series, and breadcrumbs),
`PoliciesHost` / `PolicyDetailHost` (with `PolicyDialog` and the
`PolicyAssignmentDialog` whose scoped pickers now bind the products /
distribution / suppliers / markets / crm react hooks instead of an app-local
entity combobox), `TemplatesHost` / `TemplateDetailHost` (rich-text template
dialogs stay lazy-loaded inside the package), and `NumberSeriesHost`.
Cross-route links resolve through the semantic destination keys (RFC §4.7)
via `useAdminHref`/`useAdminNavigate` — new keys `legal.home`,
`contract.list`/`contract.detail`, `contractTemplate.list`/
`contractTemplate.detail`, `policy.list`/`policy.detail`; shared keys
(`person.detail`, `booking.detail`) come from the bookings-ui augmentation.
The attachment download href is built from the shared legal provider
context's `baseUrl` instead of a host env helper.
`createLegalAdminExtension` contributes the legal route metadata (no nav —
the Legal group is base-nav-owned; no search contracts — the legal pages
keep filter state component-local; no widgets). Host route files shrink to
param binding; `component:` stays off the route contributions until the
§4.2 code-based route assembly lands. New legal-ui peers: `@voyantjs/admin`,
`@voyantjs/bookings-react`, `@voyantjs/bookings-ui`,
`@voyantjs/distribution-react`, `@voyantjs/markets-react`,
`@voyantjs/products-react`, `@voyantjs/suppliers-react`.

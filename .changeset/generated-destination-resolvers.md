---
"@voyantjs/admin": minor
"@voyantjs/availability-react": minor
"@voyantjs/bookings-react": minor
"@voyantjs/crm-react": minor
"@voyantjs/finance-react": minor
"@voyantjs/legal-react": minor
"@voyantjs/notifications-react": minor
"@voyantjs/resources-react": minor
"@voyantjs/suppliers-react": minor
---

Generated destination resolver maps (packaged-admin RFC §4.7 endgame).

`AdminUiRouteContribution` gains `destination?: AdminDestinationKey` +
`destinationParams?: Record<string, string>`: a route contribution now
DECLARES which semantic destination key its path satisfies by pure param
interpolation (e.g. `/suppliers/$id` satisfying
`"supplier.detail": { supplierId: string }` via `{ id: "supplierId" }`).
The eight domain packages annotate their 29 route-backed destinations, so
`voyant admin generate --destinations` can emit the host's resolver map
instead of the host hand-writing it — the operator's map shrank to
`{ ...generatedAdminDestinations, ...custom }` with only seven genuinely
custom resolvers (search-param construction, multi-route targets, and
host-owned pages), and `voyant admin doctor` gates on drift between the
annotations and the generated module.

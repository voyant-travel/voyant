---
"@voyantjs/resources-ui": minor
---

Packaged-admin RFC resources pages delivered: the operator's resources
wrappers move into `@voyantjs/resources-ui/admin` as packaged hosts —
`ResourcesHost` (zero-prop tab dashboard with the operator-grade
create/edit dialogs `ResourceDialog`, `ResourcePoolDialog`,
`ResourceAllocationDialog`, `ResourceSlotAssignmentDialog`,
`ResourceCloseoutDialog` bound to the shared resources provider context,
plus `batch-update`/`batch-delete` bulk mutations with localized toasts)
and the four detail hosts `ResourceDetailHost`, `ResourcePoolDetailHost`,
`ResourceAllocationDetailHost`, `ResourceAssignmentDetailHost`, with the
matching `ResourcesPageSkeleton`/`ResourcesBodySkeleton`. Cross-route links
resolve through the semantic destination keys (RFC §4.7) via
`useAdminHref`/`useAdminNavigate` — new keys `resource.list`,
`resource.detail`, `resourcePool.detail`, `resourceAllocation.detail`,
`resourceAssignment.detail`, plus shape-locked `supplier.detail`,
`product.detail`, and `availabilitySlot.detail`; mutations go through the
resources provider context's `baseUrl` + `fetcher` instead of an app RPC
client. The SSR loader contract ships as `ensureResourcesPageData` +
`resourcesPageQueryFilters` so route loaders and the page's hooks share
query keys (`ResourcesPage` gains `queryFilters` + `loadingFallback`
props). `createResourcesAdminExtension` contributes the resources route
metadata (no nav — the Resources item is base-nav-owned; no search
contracts — the dashboard keeps tab/filter state local; no widgets). Host
route files shrink to param binding; `component:` stays off the route
contributions until the §4.2 code-based route assembly lands. New
resources-ui peers: `@voyantjs/admin`, `react-hook-form`, `sonner`, `zod`.

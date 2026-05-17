---
"@voyantjs/admin": patch
---

Admin shell + dashboard refresh.

- New `AdminBreadcrumbs` primitive (exported from the package root) with a context-based registry so nested layouts can contribute crumbs without prop-drilling.
- `DashboardPage` revenue/booking charts: keep raw status keys so `ChartContainer`'s config resolves the right localized labels for both legend and tooltip, and let the chart card span the full grid width with the empty-state branch rendered consistently with the other KPI cards.
- `OperatorAdminSidebar` cleanup: navigation items and statuses (`COMING_SOON` / `BETA`) now flow through the shared `operator-navigation` config so the sidebar, command menu, and breadcrumbs stay in sync.
- `dashboard-query-options` exposes the bookings/finance KPI keys consumed by the new dashboard layout.

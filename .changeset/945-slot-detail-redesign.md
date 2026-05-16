---
"@voyantjs/availability-ui": minor
"@voyantjs/i18n": patch
---

Redesign `AvailabilitySlotDetailPage` from a debug-dump card stack into a tabbed workspace.

- One compact header (product name + date range + nights + status pills) replaces the start-date-concatenated-with-itself title and the three "Unlimited / Past Cutoff / Too Early : Yes/No" rows.
- 4-cell **KPI strip** (pax remaining/initial, product, date, notes).
- 5-tab body: **Allocation** (default) · **Pickup** · **Closeouts** · **Activity** · **Meta**. Counts render as badges on the tab triggers; empty tabs show one inline message instead of a full empty card. Activity bundles the audit log + resource-assignment list; Meta holds identifiers + lifecycle timestamps.
- Null detail rows (rule / start time / ends at / initial pickups / remaining pickups / remaining resources) hide instead of rendering a dash.
- New slot props on the package:
  - `breadcrumb?: ReactNode` — host renders breadcrumbs in its own chrome (sidebar inset top bar).
  - `headerActions?: ReactNode` — host can override the in-page Open product / Delete buttons and render them elsewhere.
  - `renderAllocation?: ({ slotId, productId }) => ReactNode` — host mounts the allocation manager (keeps `availability-ui` free of any runtime dependency on `allocation-ui`).
- Product / start time rows in the Meta tab are real links via the existing `onOpenProduct` / `onOpenStartTime` callbacks.

`@voyantjs/i18n`: new keys under `availability.details.tabs.*` for the detail page's tabbed body (en + ro).

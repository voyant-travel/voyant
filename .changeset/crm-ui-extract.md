---
"@voyantjs/crm-ui": minor
---

New package `@voyantjs/crm-ui` — importable React components for Voyant CRM. First per-domain `*-ui` package, mirrors the `*-react` split.

**Components included** (12): `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`, `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`, `ActivitiesPage`, `CreateActivityDialog`, `CreateOpportunityDialog`. All take `className` and merge via `cn()`; data fetching is delegated to `@voyantjs/crm-react` hooks.

**Components NOT included** (registry-only for now): `quotes-page`, `create-quote-dialog`, `quote-detail-sections`, `opportunities-board`, `opportunity-summary-card`, `organization-detail-page`, `organization-detail-sections`. These either hard-couple to `@tanstack/react-router` or depend on template-local helpers (`@/components/voyant/crm/inline-*`, `crm-constants`, etc.) that aren't part of the registry surface. They remain consumable via `npx shadcn add @voyant/...` and can be promoted to the package when the couplings are factored out.

**Peers:** `@voyantjs/crm-react`, `@voyantjs/voyant-ui`, `@tanstack/react-query`, `react`, `react-dom`.

**Two distribution modes for CRM components going forward:**
- Use as-is or extend via composition → `pnpm add @voyantjs/crm-ui`
- Need to fork → `npx shadcn add @voyant/<component>` (registry path, unchanged)

# @voyantjs/crm-ui

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/crm-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0
  - @voyantjs/utils@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/crm-react@0.20.0
- @voyantjs/i18n@0.20.0
- @voyantjs/ui@0.20.0
- @voyantjs/utils@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/crm-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0
- @voyantjs/utils@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/crm-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0
- @voyantjs/utils@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/crm-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0
  - @voyantjs/utils@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/crm-react@0.16.0
- @voyantjs/ui@0.16.0
- @voyantjs/utils@0.16.0

## 0.15.0

### Minor Changes

- cccc905: New package `@voyantjs/crm-ui` — importable React components for Voyant CRM. First per-domain `*-ui` package, mirrors the `*-react` split.

  **Components included** (12): `PersonCard`, `PersonCardConnected`, `PersonDialog`, `PersonForm`, `PersonList`, `OrganizationCard`, `OrganizationDialog`, `OrganizationForm`, `OrganizationList`, `ActivitiesPage`, `CreateActivityDialog`, `CreateOpportunityDialog`. All take `className` and merge via `cn()`; data fetching is delegated to `@voyantjs/crm-react` hooks.

  **Components NOT included** (registry-only for now): `quotes-page`, `create-quote-dialog`, `quote-detail-sections`, `opportunities-board`, `opportunity-summary-card`, `organization-detail-page`, `organization-detail-sections`. These either hard-couple to `@tanstack/react-router` or depend on template-local helpers (`@/components/voyant/crm/inline-*`, `crm-constants`, etc.) that aren't part of the registry surface. They remain consumable via `npx shadcn add @voyant/...` and can be promoted to the package when the couplings are factored out.

  **Peers:** `@voyantjs/crm-react`, `@voyantjs/ui`, `@tanstack/react-query`, `react`, `react-dom`.

  **Two distribution modes for CRM components going forward:**

  - Use as-is or extend via composition → `pnpm add @voyantjs/crm-ui`
  - Need to fork → `npx shadcn add @voyant/<component>` (registry path, unchanged)

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/crm-react@0.15.0
  - @voyantjs/ui@0.15.0
  - @voyantjs/utils@0.15.0

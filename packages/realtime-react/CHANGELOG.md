# @voyant-travel/realtime-react

## 0.2.2

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.

## 0.2.1

### Patch Changes

- d83d237: Repair packaged consumer development and production startup, keep shared UI
  contexts single-instanced under Vite, make unconfigured realtime quiet, and
  restore narrow client-safe validation and Finance voucher setup exports. Resolve
  legacy frontend imports through product-owned browser facades and allow clean CI
  installs to fetch metadata for external dependencies.

## 0.2.0

### Minor Changes

- 490d132: Move the authenticated admin workspace realtime provider into the public React package.
- 490d132: Package reusable admin host destinations, dashboard and extension composition,
  current-user bindings, and realtime invalidation presentation.

### Patch Changes

- 490d132: Compose selected-graph and project-local admin extensions through the generic admin host, and declare Realtime's admin integration directly in its package manifest.

## 0.1.1

### Patch Changes

- da99f12: Handle realtime token mint failures inside subscription hooks so failed token routes do not surface as unhandled promise rejections.

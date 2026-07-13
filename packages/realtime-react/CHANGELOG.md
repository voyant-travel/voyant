# @voyant-travel/realtime-react

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

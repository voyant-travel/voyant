# @voyantjs/admin

## 0.26.5

### Patch Changes

- @voyantjs/i18n@0.26.5
- @voyantjs/react@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/i18n@0.26.4
- @voyantjs/react@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/i18n@0.26.3
- @voyantjs/react@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/i18n@0.26.2
- @voyantjs/react@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/i18n@0.26.1
- @voyantjs/react@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/i18n@0.26.0
- @voyantjs/react@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/i18n@0.25.0
- @voyantjs/react@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- c112761: Add a single-tenant-first operator admin bootstrap gate and update first-party
  templates to render authenticated shells from current-user readiness instead of
  workspace or organization bootstrap state.
  - @voyantjs/i18n@0.24.3
  - @voyantjs/react@0.24.3
  - @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/i18n@0.24.2
- @voyantjs/react@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- ed635c7: Expose consistent Tailwind v4 style helper imports across admin and UI packages,
  and document single-tenant auth shell bootstrap without mandatory workspace
  organization routes.
- Updated dependencies [ed635c7]
  - @voyantjs/i18n@0.24.1
  - @voyantjs/react@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/i18n@0.24.0
- @voyantjs/react@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/i18n@0.23.0
- @voyantjs/react@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Minor Changes

- 930ec96: Package reusable operator admin shell composition and availability UI surfaces.

  `@voyantjs/admin` now exports reusable operator shell providers, navigation helpers, sidebar/workspace layout components, widget slot rendering, locale preference sync, and operator message provider utilities.

  `@voyantjs/availability-ui` now provides reusable availability overview, tab panels, dialogs with app-owned mutation adapters, table column builders, status helpers, loading skeletons, section headers, and selection-label formatting for operator apps.

### Patch Changes

- @voyantjs/i18n@0.22.0
- @voyantjs/react@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/i18n@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/i18n@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/i18n@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/i18n@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/i18n@0.18.0

## 0.17.0

### Minor Changes

- 66d722d: Published `@voyantjs/admin` (renamed from the previously-private `@voyantjs/voyant-admin`). The redundant scope/prefix was inconsistent with the rest of the workspace (`@voyantjs/auth`, `@voyantjs/crm`, …). Templates that referenced `@voyantjs/voyant-admin` as `workspace:*` now use `@voyantjs/admin` and resolve to the published package on scaffold.

  Includes the full publish setup: `tsconfig.build.json`, `build` / `prepack` scripts, `files: ["dist"]`, `publishConfig.exports` for all 9 subpaths (`.`, `./extensions`, `./providers/{theme,locale,query-client,admin-provider}`, `./lib/{i18n,initials}`, `./types`).

### Patch Changes

- Updated dependencies [66d722d]
  - @voyantjs/i18n@0.17.0

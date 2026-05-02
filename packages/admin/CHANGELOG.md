# @voyantjs/admin

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

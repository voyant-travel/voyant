# @voyantjs/booking-requirements-ui

## 0.27.0

### Patch Changes

- Updated dependencies [dc46e37]
  - @voyantjs/booking-requirements-react@0.27.0
  - @voyantjs/i18n@0.27.0
  - @voyantjs/ui@0.27.0

## 0.26.9

### Patch Changes

- Updated dependencies [24a121e]
  - @voyantjs/booking-requirements-react@0.26.9
  - @voyantjs/i18n@0.26.9
  - @voyantjs/ui@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.8
- @voyantjs/i18n@0.26.8
- @voyantjs/ui@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.7
- @voyantjs/i18n@0.26.7
- @voyantjs/ui@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.6
- @voyantjs/i18n@0.26.6
- @voyantjs/ui@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.5
- @voyantjs/i18n@0.26.5
- @voyantjs/ui@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.4
- @voyantjs/i18n@0.26.4
- @voyantjs/ui@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.3
- @voyantjs/i18n@0.26.3
- @voyantjs/ui@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.2
- @voyantjs/i18n@0.26.2
- @voyantjs/ui@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.1
- @voyantjs/i18n@0.26.1
- @voyantjs/ui@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.26.0
- @voyantjs/i18n@0.26.0
- @voyantjs/ui@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.25.0
- @voyantjs/i18n@0.25.0
- @voyantjs/ui@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/booking-requirements-react@0.24.3
- @voyantjs/i18n@0.24.3
- @voyantjs/ui@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/booking-requirements-react@0.24.2
- @voyantjs/i18n@0.24.2
- @voyantjs/ui@0.24.2

## 0.24.1

### Patch Changes

- Updated dependencies [ed635c7]
  - @voyantjs/booking-requirements-react@0.24.1
  - @voyantjs/i18n@0.24.1
  - @voyantjs/ui@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.24.0
- @voyantjs/i18n@0.24.0
- @voyantjs/ui@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.23.0
- @voyantjs/i18n@0.23.0
- @voyantjs/ui@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.22.0
- @voyantjs/i18n@0.22.0
- @voyantjs/ui@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/booking-requirements-react@0.21.1
- @voyantjs/i18n@0.21.1
- @voyantjs/ui@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/booking-requirements-react@0.21.0
  - @voyantjs/i18n@0.21.0
  - @voyantjs/ui@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.20.0
- @voyantjs/i18n@0.20.0
- @voyantjs/ui@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.19.0
- @voyantjs/i18n@0.19.0
- @voyantjs/ui@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.18.0
- @voyantjs/i18n@0.18.0
- @voyantjs/ui@0.18.0

## 0.17.0

### Patch Changes

- Updated dependencies [66d722d]
- Updated dependencies [66d722d]
  - @voyantjs/booking-requirements-react@0.17.0
  - @voyantjs/i18n@0.17.0
  - @voyantjs/ui@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/booking-requirements-react@0.16.0
- @voyantjs/ui@0.16.0

## 0.15.0

### Minor Changes

- cccc905: Bulk-extract per-domain importable UI packages, mirroring the `*-react` split. 17 new `*-ui` packages shipping a combined 137 components; primitives package `voyant-ui` gains 3 promoted shared primitives (`currency-combobox`, `date-time-picker`, `country-combobox`).

  **New `*-ui` packages**: `booking-requirements`, `bookings`, `charters`, `cruises`, `distribution`, `external-refs`, `extras`, `finance`, `hospitality`, `identity`, `legal`, `markets`, `pricing`, `products`, `resources`, `sellability`, `suppliers`. (Already shipped in prior commit: `crm-ui`.)

  **`voyant-ui` additions**: `CurrencyCombobox`, `DateTimePicker`, `CountryCombobox` — promoted from registry/template-local sources because they're shared primitives that 21 domain components depend on. Adds `@voyantjs/utils` to dependencies.

  **Two distribution modes for every domain**:

  - Importable: `pnpm add @voyantjs/<domain>-ui` — version-tracked, updates flow with bumps
  - Registry: `npx shadcn add @voyant/<component>` — copy + own, fork-friendly

  **Components NOT in importable packages** (registry-only):

  - Router-coupled components (TanStack Router): legal `quotes-page`, `create-quote-dialog`, etc.
  - Template-local-helper-coupled: `@/components/voyant/crm/*` deps, `@/lib/api-client` deps
  - Components with pre-existing latent bugs surfaced by per-package compilation: API drift against `*-react` hooks (e.g., `useBookingItemParticipants` no longer exists), loose typing that worked under permissive consumer tsconfigs but not under strict library compilation, broken imports to skipped sibling components

  The full coupling-and-bug list is preserved in each package's README. These components remain consumable via the shadcn registry path; they can be promoted into the importable packages when their underlying issues are fixed.

  **Domains with no importable surface** (all components either failed to compile or were registry-only by design): `auth`, `ground`, `notifications`, `transactions`. Their components remain available via the registry.

  **Tree-shaking**: `sideEffects: false` is set across all packages. With ESM + Bundler-resolution, modern bundlers (Vite, webpack, Next.js) drop unused named exports through barrels.

### Patch Changes

- Updated dependencies [cccc905]
- Updated dependencies [361c8c5]
- Updated dependencies [e84fe0f]
- Updated dependencies [24869f4]
- Updated dependencies [cccc905]
  - @voyantjs/booking-requirements-react@0.15.0
  - @voyantjs/ui@0.15.0

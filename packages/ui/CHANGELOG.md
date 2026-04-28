# @voyantjs/ui

## 0.15.0

### Minor Changes

- 361c8c5: Add `DateTimePicker` primitive (`@/components/ui/date-time-picker`) and migrate every remaining `<Input type="datetime-local">` in the registry.

  - Registered as `voyant-date-time-picker` in `packages/ui/registry.json` (`type: "registry:ui"`) so external consumers can install via `shadcn add voyant-date-time-picker`.
  - Composes Calendar + an `HH:mm` time input inside a Popover, with the value serialized as `"YYYY-MM-DDTHH:mm"` — drop-in compatible with the native `<input type="datetime-local">` contract.
  - Picking a new day preserves the existing time-of-day; clearing the time falls back to `00:00`.
  - Supports the same `disabled` / `dateDisabled` / `clearable` props as the enhanced DatePicker.
  - Migrated 6 sites across 4 registry files (booking guarantee, distribution sync + webhook dialogs, legal contract dialog), plus template copies in `templates/dmc`, `templates/operator`, `apps/dev`.

- 24869f4: UI consistency sweep across every registry dialog and form:

  - **New primitive**: `CurrencyCombobox` (`@/components/ui/currency-combobox`) — searchable currency picker backed by the canonical `currencies` list from `@voyantjs/utils`. Trigger renders `CODE (symbol)`; items render `CODE — Name (symbol)`. Registered in `packages/ui/registry.json` as `voyant-currency-combobox` with `type: "registry:ui"` so external consumers can install via `shadcn add voyant-currency-combobox`.
  - **DatePicker enhancement**: added first-class `disabled?: boolean` (disables the entire picker) and `dateDisabled` (day-level matcher, forwards to underlying Calendar) props. Replaces prior ambiguity where `disabled` collided with react-day-picker's Matcher type.
  - **Swept every registry dialog + form**:
    - Native `<Input type="date">` → `<DatePicker>` (56 sites across bookings, finance, transactions, hospitality, legal, distribution, products).
    - Currency `<Input maxLength={3}>` → `<CurrencyCombobox>` (18 sites across the same domains).
    - Bare `<SelectTrigger>` → `<SelectTrigger className="w-full">` so the trigger fills its form column (~118 sites across every domain).
  - Template copies in `templates/dmc`, `templates/operator`, and `apps/dev` synced with the registry source.

- cccc905: `@voyantjs/ui` is now publishable. Consumers can `pnpm add @voyantjs/ui` and import primitives directly instead of copying them via the shadcn registry — updates flow with version bumps. The registry path remains for components you intend to fork.

  **What changed:**

  - `private: true` flipped to publishable; package removed from changesets `ignore` and added to the linked release group.
  - New `tsconfig.build.json` emits `dist/` (JS + `.d.ts` + declaration maps) under `module: ESNext` / `moduleResolution: Bundler`. The package is bundler-consumed by design.
  - New `build`, `clean`, `prepack`, `typecheck` scripts. `prepack` runs the build so `pnpm pack` produces a complete tarball.
  - `publishConfig.exports` mirrors the dev `exports` map but points at `./dist/*.js` + `./dist/*.d.ts`. Workspace consumers continue to resolve `./src/*` directly; only published consumers see the dist paths.
  - `files: ["dist", "src/styles", "postcss.config.mjs"]` — `globals.css` ships as-is for consumers to import.
  - Editor `tsconfig.json` aligned to `Bundler` resolution to match the build (avoids extensionless-import false positives in `tsc --noEmit`).
  - One latent type bug in `input-group.tsx` fixed (`querySelector` lacked an explicit element-type narrowing).

  **Tree-shaking:** `sideEffects: false` is set across all UI/react packages in this repo, so unused named exports drop through barrels in modern bundlers.

### Patch Changes

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

- e84fe0f: Add shared upload-aware media workflows to the product registry components.

  `product-media-section` now supports optional file upload handlers and compact
  embedded rendering for day-level media management. `product-itinerary-section`
  now renders the shared day-media section directly inside expanded itinerary day
  rows, so apps no longer need a local wrapper just to manage day media uploads.

  - @voyantjs/notifications@0.15.0
  - @voyantjs/notifications-react@0.15.0
  - @voyantjs/utils@0.15.0

# @voyant-travel/inventory

## 0.3.0

### Minor Changes

- 13fe70b: The inventory module now owns the product brochure route: new `@voyant-travel/inventory/routes-brochure` export (`createProductBrochureRoutes(options)`) with the object storage provider injected as an option.

### Patch Changes

- Updated dependencies [13fe70b]
- Updated dependencies [11095db]
- Updated dependencies [13fe70b]
- Updated dependencies [13fe70b]
- Updated dependencies [9ea7220]
- Updated dependencies [13fe70b]
  - @voyant-travel/action-ledger@0.105.0
  - @voyant-travel/catalog@0.119.0
  - @voyant-travel/commerce@0.3.0
  - @voyant-travel/hono@0.111.0
  - @voyant-travel/storage@0.105.0
  - @voyant-travel/operations@0.1.1

## 0.2.0

### Minor Changes

- 3cc83b6: Move extras runtime and React source behind Inventory and Bookings owner
  subpaths. The old runtime and React extras package names are removed from v1;
  first-party imports use the Inventory and Bookings owner paths.
- 7ea516a: Move product graph compose/duplicate authoring behind
  `@voyant-travel/inventory/authoring`. `@voyant-travel/catalog-authoring` now delegates to
  the Inventory owner path during the v1 restructure.
- 65b3782: Add optional Inventory package entrypoints for operated product authoring and
  Inventory React authoring UI surfaces.
- a101971: Move the main operated Product route/service/schema/runtime and React
  authoring source under Inventory owner paths. The old Products runtime package
  names are removed from the v1 workspace surface, while the operator keeps
  stable `/products` API URLs backed by Inventory.

### Patch Changes

- 3408b2a: Move availability, allocation UI, resources, ground logistics, and places source
  under Operations owner paths. The old operated-execution package names are
  removed from the v1 workspace surface while first-party runtime, React, and
  operator imports use `@voyant-travel/operations` and `@voyant-travel/operations-react`
  surfaces.
- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [c9ec9f8]
- Updated dependencies [e388bc9]
- Updated dependencies [6bff46f]
- Updated dependencies [a4e0909]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [3408b2a]
- Updated dependencies [47fef18]
- Updated dependencies [063f2b5]
  - @voyant-travel/catalog@0.118.0
  - @voyant-travel/commerce@0.2.0
  - @voyant-travel/hono@0.110.0
  - @voyant-travel/operations@0.1.0
  - @voyant-travel/extras-contracts@0.104.2
  - @voyant-travel/action-ledger@0.104.11

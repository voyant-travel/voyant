# @voyant-travel/commerce-react

## 0.2.1

### Patch Changes

- eef1a00: Republish notification and UI consumer packages so stale beta artifacts no longer reference legacy notification package specifiers.
- Updated dependencies [eef1a00]
  - @voyant-travel/admin@0.111.2
  - @voyant-travel/distribution-react@0.110.4
  - @voyant-travel/inventory-react@0.2.1

## 0.2.0

### Minor Changes

- 97d520c: Add the Commerce React owner package and retarget first-party UI wiring to the
  Commerce owner path.
- 85f9ce1: Move commercial React/admin source under the Commerce React owner path and
  remove the old Markets, Pricing, Promotions, and Sellability React package
  names from the v1 workspace surface.

### Patch Changes

- 47fef18: Retarget first-party imports from the removed beta package names to their owner
  packages. Operated product UI now imports Inventory React, commercial UI imports
  Commerce React, supplier UI imports Distribution React, checkout UI imports
  Finance React, and operated place/availability schema references import
  Operations owner paths.
- Updated dependencies [dd71543]
- Updated dependencies [e388bc9]
- Updated dependencies [6bff46f]
- Updated dependencies [a4e0909]
- Updated dependencies [eb17d3d]
- Updated dependencies [3cc83b6]
- Updated dependencies [3408b2a]
- Updated dependencies [3e160d3]
- Updated dependencies [65b3782]
- Updated dependencies [a101971]
- Updated dependencies [47fef18]
- Updated dependencies [063f2b5]
  - @voyant-travel/admin@0.111.1
  - @voyant-travel/commerce@0.2.0
  - @voyant-travel/inventory-react@0.2.0
  - @voyant-travel/distribution-react@0.110.0

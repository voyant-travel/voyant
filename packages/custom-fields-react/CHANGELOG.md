# @voyant-travel/custom-fields-react

## 0.4.2

### Patch Changes

- Updated dependencies [c2ca4a3]
  - @voyant-travel/i18n@0.115.0
  - @voyant-travel/admin@0.128.2

## 0.4.1

### Patch Changes

- Updated dependencies [ecf1680]
  - @voyant-travel/i18n@0.114.0
  - @voyant-travel/admin@0.128.1

## 0.4.0

### Patch Changes

- Updated dependencies [2bcafc9]
  - @voyant-travel/admin@0.128.0
  - @voyant-travel/i18n@0.113.0

## 0.3.0

### Patch Changes

- Updated dependencies [a461920]
- Updated dependencies [a461920]
  - @voyant-travel/admin@0.127.0

## 0.2.4

### Patch Changes

- Updated dependencies [0868f18]
- Updated dependencies [3062a73]
  - @voyant-travel/admin@0.126.2
  - @voyant-travel/i18n@0.112.0

## 0.2.3

### Patch Changes

- 70a39fc: Declare the repository field so npm provenance verification accepts the publish (0.2.1 was rejected with E422: repository.url "" did not match the GitHub Actions provenance).

## 0.2.2

### Patch Changes

- 207a29c: Declare the repository field so npm provenance verification accepts the publish (0.2.1 was rejected with E422: repository.url "" did not match the GitHub Actions provenance).

## 0.2.1

### Patch Changes

- 1add58a: Republish with compiled output: 0.2.0 was packed without `prepack`, so the tarball shipped no `dist/` and its entry points were unresolvable for consumers.

## 0.2.0

### Minor Changes

- 52352c4: Move custom-field definition Settings ownership to the generic custom-fields
  package. Selected entity manifests now declare the targets and field types that
  the canonical API may accept. The unused Relationships definition API and
  Settings surfaces are removed without compatibility adapters.

  Target capability declarations now constrain searchable, exportable, and
  invoiceable settings end to end, and unsupported flags are stored as false.

- 52352c4: Persist custom-field namespace, owner, lifecycle, and provenance metadata.
  Operator definitions use the reserved `custom` namespace, app operations are
  owner-constrained, platform definitions derive ownership from the selected
  target, and Settings renders non-operator definitions as read-only.

### Patch Changes

- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
  - @voyant-travel/custom-fields@0.2.0

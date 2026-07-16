# @voyant-travel/custom-fields-react

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

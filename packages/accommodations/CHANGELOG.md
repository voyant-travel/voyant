# @voyantjs/accommodations

## 0.55.0

### Minor Changes

- f0c2a6d: Add the accommodation resale package and retire the legacy hospitality package family.

  Accommodation inventory remains available as catalog resale content for OTAs, DMCs, and tour operators, while first-party hotel-managed operations surfaces are removed from the active package, template, and UI registry surfaces. Consumers should use `@voyantjs/accommodations` for lodging catalog and stay booking-line integrations instead of the removed `@voyantjs/hospitality`, `@voyantjs/hospitality-react`, and `@voyantjs/hospitality-ui` package family.

### Patch Changes

- @voyantjs/bookings@0.55.0
- @voyantjs/catalog@0.55.0
- @voyantjs/db@0.55.0
- @voyantjs/facilities@0.55.0

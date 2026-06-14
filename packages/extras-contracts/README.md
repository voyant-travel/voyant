# @voyant-travel/extras-contracts

Pure extras content contracts for adapter implementers and external consumers
that need to validate `extras/v1` rich content payloads without installing the
runtime owner packages.

Use this package for `EXTRAS_CONTENT_SCHEMA_VERSION`, `extraContentSchema`,
`ExtraContent`, nested content types, and `validateExtraContent`.

ADR-0002 keeps this package separate because it is a real zod-only external
payload seam. Use `@voyant-travel/inventory/extras` for operated add-on authoring and
catalog projection/content-cache helpers. Use `@voyant-travel/bookings/extras` for
booking extra lines, participant selections, slot manifests, and booked-state
runtime behavior.

## Install

```bash
pnpm add @voyant-travel/extras-contracts zod
```

## Usage

```ts
import {
  EXTRAS_CONTENT_SCHEMA_VERSION,
  extraContentSchema,
  type ExtraContent,
} from "@voyant-travel/extras-contracts"
```

Runtime extras authoring lives in `@voyant-travel/inventory/extras`; booked extras
state lives in `@voyant-travel/bookings/extras`.

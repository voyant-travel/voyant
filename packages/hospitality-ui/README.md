# @voyantjs/hospitality-ui

Legacy React UI components for Voyant hospitality surfaces.

This package currently includes hotel/property operations UI such as room
inventory, maintenance blocks, and other PMS-style workflows. Those surfaces are
being de-scoped from first-party Voyant starters. Do not add new first-party
hotel-operations UI here.

Accommodation resale UI should move toward catalog, storefront, products,
bookings, or a narrowly named accommodation resale surface. See
[`docs/architecture/accommodation-resale-boundary.md`](../../docs/architecture/accommodation-resale-boundary.md).

## Status

This package is not a normal first-party UI adoption surface. Do not add it to
new starters, registry blocks, or first-party workspaces. Do not use it to give
hotels a place to manage rooms, housekeeping, maintenance, folios, or in-stay
operations.

Keep any temporary usage scoped to legacy package migration. New accommodation
resale UI should be built through catalog, storefront, products, bookings, or a
narrowly named accommodation resale surface.

## I18n

Legacy components render English by default. To localize remaining temporary
usage, wrap the UI in `HospitalityUiMessagesProvider` and import only the
locales your app supports.

```tsx
import { HospitalityUiMessagesProvider } from "@voyantjs/hospitality-ui"
import { hospitalityUiEn } from "@voyantjs/hospitality-ui/i18n/en"
import { hospitalityUiRo } from "@voyantjs/hospitality-ui/i18n/ro"
```

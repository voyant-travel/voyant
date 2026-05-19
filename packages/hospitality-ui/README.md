# @voyantjs/hospitality-ui

Legacy React UI components for Voyant hospitality surfaces.

This package currently includes hotel/property operations UI such as room
inventory, maintenance blocks, and other PMS-style workflows. Those surfaces are
being de-scoped from first-party Voyant starters. Do not add new first-party
hotel-operations UI here.

Accommodation resale UI should move toward catalog, storefront, products,
bookings, or a narrowly named accommodation resale surface. See
[`docs/architecture/accommodation-resale-boundary.md`](../../docs/architecture/accommodation-resale-boundary.md).

## Install

Direct installation is transitional while hospitality UI is being split or
removed from first-party positioning.

```bash
pnpm add @voyantjs/hospitality-ui @voyantjs/hospitality-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/hospitality-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`HospitalityUiMessagesProvider` and import only the locales your app supports.

```tsx
import { HospitalityUiMessagesProvider } from "@voyantjs/hospitality-ui"
import { hospitalityUiEn } from "@voyantjs/hospitality-ui/i18n/en"
import { hospitalityUiRo } from "@voyantjs/hospitality-ui/i18n/ro"
```

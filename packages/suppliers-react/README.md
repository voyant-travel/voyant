# @voyantjs/suppliers-react

Compatibility facade. Supplier React implementation now lives under
`@voyantjs/distribution-react/suppliers`; keep this package only for existing
imports until the v1 public-name policy removes or formally deprecates it.

The suppliers client tier: headless data hooks/clients plus the styled UI
primitives and page-level compositions (formerly `@voyantjs/suppliers-ui`).

Headless consumers (storefronts, portals) import from the root, `./hooks`,
`./client`, or `./query-keys` — these pull no styling peers. Styled surfaces
live under `./ui`, `./components/*`, `./admin`, `./i18n`, and `./styles.css`,
whose heavier peers (`@voyantjs/ui`, `@voyantjs/admin`,
`@tanstack/react-table`, `react-hook-form`) are optional and only needed when
you import those subpaths.

## Install

```bash
pnpm add @voyantjs/suppliers-react @voyantjs/suppliers @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantSuppliersProvider, useSuppliers } from "@voyantjs/suppliers-react"

function App() {
  return (
    <VoyantSuppliersProvider baseUrl="/api">
      <SuppliersList />
    </VoyantSuppliersProvider>
  )
}

function SuppliersList() {
  const { data } = useSuppliers({ limit: 50 })
  return <>{data?.data.map((supplier) => <div key={supplier.id}>{supplier.name}</div>)}</>
}
```

New first-party code should import from `@voyantjs/distribution-react/suppliers`.

## UI components

Importable React UI components for Voyant suppliers. Bundler-consumed (Vite, Next.js, webpack, etc.).

### Install

```bash
pnpm add @voyantjs/suppliers-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives; the data-layer hooks ship
in this same package. Both are required when using the styled subpaths.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

### I18n

Components render English by default. To localize them, wrap your UI in
`SuppliersUiMessagesProvider` and import only the locales your app supports.

```tsx
import { SuppliersUiMessagesProvider } from "@voyantjs/suppliers-react/ui"
import { suppliersUiEn } from "@voyantjs/suppliers-react/i18n/en"
import { suppliersUiRo } from "@voyantjs/suppliers-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

## License

Apache-2.0

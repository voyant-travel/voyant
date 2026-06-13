# @voyantjs/products-react

Compatibility entrypoint for the operated Product React runtime.

The implementation now lives under `@voyantjs/inventory-react`. Existing
`@voyantjs/products-react` imports remain supported for v1 compatibility. New
operated-authoring UI code should import from `@voyantjs/inventory-react`.

Headless consumers (storefronts, portals) import from the root, `./hooks`,
`./client`, or `./query-keys` — these pull no styling peers. Styled surfaces
live under `./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose
heavier peers (`@voyantjs/ui`, `@voyantjs/catalog-react`,
`@voyantjs/pricing-react/ui`, `@voyantjs/finance-react/ui`, and the other `*-react`
module peers) are optional and only needed when you import those subpaths.

React runtime package for Voyant operated inventory. Provides the shared
products provider, typed fetch client, query keys, and TanStack Query hooks that
power product-focused frontend experiences.

## Install

```bash
pnpm add @voyantjs/inventory-react @voyantjs/inventory @tanstack/react-query react react-dom zod
```

## Usage

```tsx
import { VoyantProductsProvider, useProducts } from "@voyantjs/inventory-react"

function App() {
  return (
    <VoyantProductsProvider baseUrl="/api">
      <ProductsList />
    </VoyantProductsProvider>
  )
}

function ProductsList() {
  const { data } = useProducts()
  return <>{data?.data.map((product) => <div key={product.id}>{product.name}</div>)}</>
}
```

## Relationship To The Registry

`@voyantjs/inventory-react` is the runtime layer. Installable product UI blocks
should depend on Inventory React for hooks, client state, and provider wiring.

## UI components

Importable React UI components for Voyant products. Bundler-consumed (Vite,
Next.js, webpack, etc.). Import them from `@voyantjs/inventory-react/ui` or the
granular `@voyantjs/inventory-react/components/*` subpaths.

### Install

```bash
pnpm add @voyantjs/inventory-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives; the root of this package provides the data-layer hooks.
`ProductTypesPage` also uses `react-hook-form` and `zod` for sheet validation.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

### Components

- `ProductsPage` publishes the product list composition.
- `ProductDetailPage` publishes the complete product detail workspace with
  overview, media, itinerary, option, and version tabs.
- `ProductDetailHeader`, `ProductOverviewCard`, `ProductCommercialCard`,
  `ProductDetailSidebar`, and `ProductItinerarySection` remain exported for
  consumers that need to compose the detail page manually.
- Product category, type, and tag pages publish reusable list-management compositions.

### I18n

Components render English by default. To localize them, wrap your UI in
`ProductsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ProductsUiMessagesProvider } from "@voyantjs/inventory-react/ui"
import { productsUiEn } from "@voyantjs/inventory-react/i18n/en"
import { productsUiRo } from "@voyantjs/inventory-react/i18n/ro"
```

## License

Apache-2.0

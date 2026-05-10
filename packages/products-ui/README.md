# @voyantjs/products-ui

Importable React UI components for Voyant products. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/products-ui @voyantjs/products-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/products-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Components

- `ProductsPage` publishes the product list composition.
- `ProductDetailPage` publishes the complete product detail workspace with
  overview, media, itinerary, option, and version tabs.
- `ProductDetailHeader`, `ProductOverviewCard`, `ProductCommercialCard`,
  `ProductDetailSidebar`, and `ProductItinerarySection` remain exported for
  consumers that need to compose the detail page manually.
- Product category and tag pages publish reusable list-management compositions.

## I18n

Components render English by default. To localize them, wrap your UI in
`ProductsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ProductsUiMessagesProvider } from "@voyantjs/products-ui"
import { productsUiEn } from "@voyantjs/products-ui/i18n/en"
import { productsUiRo } from "@voyantjs/products-ui/i18n/ro"
```

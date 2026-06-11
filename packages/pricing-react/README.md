# @voyantjs/pricing-react

The pricing client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyantjs/pricing-ui`).

Headless consumers import from the root, `./hooks`, `./client`, or
`./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose heavier peers
(`@voyantjs/ui`, `@voyantjs/products-react`, `@tanstack/react-table`) are
optional and only needed when you import those subpaths.

React hooks and provider utilities for Voyant pricing APIs.

Current surface:

- pricing categories
- pricing category dependencies

## UI components

Importable React UI components for Voyant pricing. Bundler-consumed (Vite, Next.js, webpack, etc.).

### Install

```bash
pnpm add @voyantjs/pricing-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives; the data-layer hooks ship in this package.
`PriceCatalogsPage` also uses `@voyantjs/utils`, `react-hook-form`, and `zod` for currency selection and sheet validation.

### Components

- `PricingCategoriesPage` publishes the reusable pricing category management composition.
- `PriceCatalogsPage` publishes the reusable price catalog management composition.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

### I18n

Components render English by default. To localize them, wrap your UI in
`PricingUiMessagesProvider` and import only the locales your app supports.

```tsx
import { PricingUiMessagesProvider } from "@voyantjs/pricing-react/ui"
import { pricingUiEn } from "@voyantjs/pricing-react/i18n/en"
import { pricingUiRo } from "@voyantjs/pricing-react/i18n/ro"
```

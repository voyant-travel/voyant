# @voyantjs/pricing-ui

Importable React UI components for Voyant pricing. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/pricing-ui @voyantjs/pricing-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/pricing-react` provides the data-layer hooks. Both are required peers.
`PriceCatalogsPage` also uses `@voyantjs/utils`, `react-hook-form`, and `zod` for currency selection and sheet validation.

## Components

- `PricingCategoriesPage` publishes the reusable pricing category management composition.
- `PriceCatalogsPage` publishes the reusable price catalog management composition.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`PricingUiMessagesProvider` and import only the locales your app supports.

```tsx
import { PricingUiMessagesProvider } from "@voyantjs/pricing-ui"
import { pricingUiEn } from "@voyantjs/pricing-ui/i18n/en"
import { pricingUiRo } from "@voyantjs/pricing-ui/i18n/ro"
```

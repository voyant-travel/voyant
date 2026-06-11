# @voyantjs/sellability-react

The sellability client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyantjs/sellability-ui`).

Headless consumers (storefronts, portals) import from the root, `./hooks`,
`./client`, or `./query-keys` — these pull no styling peers. Styled surfaces
live under `./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose
heavier peers (`@voyantjs/ui`, `@tanstack/react-table`,
`@voyantjs/distribution-react`, `@voyantjs/markets-react`,
`@voyantjs/products-react`) are optional and only needed when you import
those subpaths.

## UI components

Importable React UI components for Voyant sellability. Bundler-consumed (Vite, Next.js, webpack, etc.).

### Install

```bash
pnpm add @voyantjs/sellability-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. The root and `./hooks`
subpaths of this package provide the data-layer hooks.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

### I18n

Components render English by default. To localize them, wrap your UI in
`SellabilityUiMessagesProvider` and import only the locales your app supports.

```tsx
import { SellabilityUiMessagesProvider } from "@voyantjs/sellability-react/ui"
import { sellabilityUiEn } from "@voyantjs/sellability-react/i18n/en"
import { sellabilityUiRo } from "@voyantjs/sellability-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

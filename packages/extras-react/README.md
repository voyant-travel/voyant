# @voyantjs/extras-react

The extras client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyantjs/extras-ui`).

Headless consumers import from the root, `./hooks`, or `./client` — these
pull no styling peers. Styled surfaces live under `./ui`, `./components/*`,
`./i18n`, and `./styles.css`, whose heavier peers (`@voyantjs/ui`,
`@voyantjs/catalog-react`, `@voyantjs/products-react`,
`@tanstack/react-table`) are optional and only needed when you import those
subpaths.

## UI components

Importable React UI components for Voyant extras. Bundler-consumed (Vite, Next.js, webpack, etc.).

### Install

```bash
pnpm add @voyantjs/extras-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives; the data-layer hooks
ship in this same package (root and `./hooks` subpaths).

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

### I18n

Components render English by default. To localize them, wrap your UI in
`ExtrasUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ExtrasUiMessagesProvider } from "@voyantjs/extras-react/ui"
import { extrasUiEn } from "@voyantjs/extras-react/i18n/en"
import { extrasUiRo } from "@voyantjs/extras-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

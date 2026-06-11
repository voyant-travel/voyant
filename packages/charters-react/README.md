# @voyantjs/charters-react

The charters client tier: headless data hooks/clients plus the styled React
UI components (formerly `@voyantjs/charters-ui`).

Headless consumers import from the root, `./hooks`, or `./client` — these
pull no styling peers. Styled surfaces live under `./ui`, `./components/*`,
`./i18n`, and `./styles.css`, whose heavier peers (`@voyantjs/ui`,
`@voyantjs/catalog-react`) are optional and only needed when you import
those subpaths.

## UI components

Importable React UI components for Voyant charters. Bundler-consumed (Vite, Next.js, webpack, etc.).

### I18n

Components render English by default. To localize them, wrap your UI in
`ChartersUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ChartersUiMessagesProvider } from "@voyantjs/charters-react/ui"
import { chartersUiEn } from "@voyantjs/charters-react/i18n/en"
import { chartersUiRo } from "@voyantjs/charters-react/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

### Install

```bash
pnpm add @voyantjs/charters-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives and is only required
when importing the styled subpaths (`./ui`, `./components/*`). The data-layer
hooks ship from the root and `./hooks` subpaths of this same package.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

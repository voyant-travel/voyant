# @voyantjs/external-refs-react

The external-refs client tier: headless data hooks/clients plus the styled UI
components (formerly `@voyantjs/external-refs-ui`).

Headless consumers import from the root, `./hooks`, `./client`, `./provider`,
or `./query-keys` — these pull no styling peers. Styled surfaces live under
`./ui`, `./components/*`, `./i18n`, and `./styles.css`, whose heavier peers
(`@voyantjs/ui`, `@tanstack/react-table`, `react-hook-form`) are optional and
only needed when you import those subpaths.

## I18n

Components render English by default. To localize them, wrap your UI in
`ExternalRefsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ExternalRefsUiMessagesProvider } from "@voyantjs/external-refs-react/ui"
import { externalRefsUiEn } from "@voyantjs/external-refs-react/i18n/en"
import { externalRefsUiRo } from "@voyantjs/external-refs-react/i18n/ro"
```

Importable React UI components for Voyant external-refs. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/external-refs-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives and is only required when
you import the styled subpaths (`./ui`, `./components/*`). The data-layer hooks
ship with the package root.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

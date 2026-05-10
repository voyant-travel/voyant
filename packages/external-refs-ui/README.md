# @voyantjs/external-refs-ui

## I18n

Components render English by default. To localize them, wrap your UI in
`ExternalRefsUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ExternalRefsUiMessagesProvider } from "@voyantjs/external-refs-ui"
import { externalRefsUiEn } from "@voyantjs/external-refs-ui/i18n/en"
import { externalRefsUiRo } from "@voyantjs/external-refs-ui/i18n/ro"
```

Importable React UI components for Voyant external-refs. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/external-refs-ui @voyantjs/external-refs-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/external-refs-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

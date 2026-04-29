# @voyantjs/extras-ui

Importable React UI components for Voyant extras. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/extras-ui @voyantjs/extras-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/extras-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`ExtrasUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ExtrasUiMessagesProvider } from "@voyantjs/extras-ui"
import { extrasUiEn } from "@voyantjs/extras-ui/i18n/en"
import { extrasUiRo } from "@voyantjs/extras-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

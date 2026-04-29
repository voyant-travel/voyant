# @voyantjs/sellability-ui

Importable React UI components for Voyant sellability. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/sellability-ui @voyantjs/sellability-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/sellability-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`SellabilityUiMessagesProvider` and import only the locales your app supports.

```tsx
import { SellabilityUiMessagesProvider } from "@voyantjs/sellability-ui"
import { sellabilityUiEn } from "@voyantjs/sellability-ui/i18n/en"
import { sellabilityUiRo } from "@voyantjs/sellability-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

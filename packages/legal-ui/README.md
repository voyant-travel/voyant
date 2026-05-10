# @voyantjs/legal-ui

Importable React UI components for Voyant legal. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/legal-ui @voyantjs/legal-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/legal-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`LegalUiMessagesProvider` and import only the locales your app supports.

```tsx
import { LegalUiMessagesProvider } from "@voyantjs/legal-ui"
import { legalUiEn } from "@voyantjs/legal-ui/i18n/en"
import { legalUiRo } from "@voyantjs/legal-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

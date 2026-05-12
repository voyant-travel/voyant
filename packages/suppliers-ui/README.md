# @voyantjs/suppliers-ui

Importable React UI components for Voyant suppliers. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/suppliers-ui @voyantjs/suppliers-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/suppliers-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

## I18n

Components render English by default. To localize them, wrap your UI in
`SuppliersUiMessagesProvider` and import only the locales your app supports.

```tsx
import { SuppliersUiMessagesProvider } from "@voyantjs/suppliers-ui"
import { suppliersUiEn } from "@voyantjs/suppliers-ui/i18n/en"
import { suppliersUiRo } from "@voyantjs/suppliers-ui/i18n/ro"
```

English-only apps should import only `./i18n/en`. Bilingual apps can import
`./i18n/en` and `./i18n/ro`.

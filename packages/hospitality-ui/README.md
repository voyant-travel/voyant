# @voyantjs/hospitality-ui

Importable React UI components for Voyant hospitality. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/hospitality-ui @voyantjs/hospitality-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/hospitality-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`HospitalityUiMessagesProvider` and import only the locales your app supports.

```tsx
import { HospitalityUiMessagesProvider } from "@voyantjs/hospitality-ui"
import { hospitalityUiEn } from "@voyantjs/hospitality-ui/i18n/en"
import { hospitalityUiRo } from "@voyantjs/hospitality-ui/i18n/ro"
```

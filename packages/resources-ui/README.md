# @voyantjs/resources-ui

Importable React UI components for Voyant resources. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/resources-ui @voyantjs/resources-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/resources-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## I18n

Components render English by default. To localize them, wrap your UI in
`ResourcesUiMessagesProvider` and import only the locales your app supports.

```tsx
import { ResourcesUiMessagesProvider } from "@voyantjs/resources-ui"
import { resourcesUiEn } from "@voyantjs/resources-ui/i18n/en"
import { resourcesUiRo } from "@voyantjs/resources-ui/i18n/ro"
```

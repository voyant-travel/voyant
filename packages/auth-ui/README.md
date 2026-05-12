# @voyantjs/auth-ui

Importable React UI components for Voyant auth surfaces. Bundler-consumed
(Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/auth-ui @voyantjs/auth-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/auth-react`
provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or
compose to extend; use the registry copy-paste path for components you want to
fork outright.

Page components render with `p-6` outer padding by default and are intended to
mount directly into an app route outlet. Pass `className` to extend or override
that spacing when a shell owns the page chrome.

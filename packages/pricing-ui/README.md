# @voyantjs/pricing-ui

Importable React UI components for Voyant pricing. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/pricing-ui @voyantjs/pricing-react @voyantjs/voyant-ui @tanstack/react-query react react-dom
```

`@voyantjs/voyant-ui` provides the design-system primitives. `@voyantjs/pricing-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

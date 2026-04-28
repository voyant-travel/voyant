# @voyantjs/identity-ui

Importable React UI components for Voyant identity. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/identity-ui @voyantjs/identity-react @voyantjs/voyant-ui @tanstack/react-query react react-dom
```

`@voyantjs/voyant-ui` provides the design-system primitives. `@voyantjs/identity-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `identity-page`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

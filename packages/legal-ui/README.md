# @voyantjs/legal-ui

Importable React UI components for Voyant legal. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/legal-ui @voyantjs/legal-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/legal-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `contract-detail-page`, `contracts-page`, `policies-page`, `policy-detail-page`, `template-detail-page`, `templates-page`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

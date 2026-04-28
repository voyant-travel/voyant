# @voyantjs/booking-requirements-ui

Importable React UI components for Voyant booking-requirements. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/booking-requirements-ui @voyantjs/booking-requirements-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/booking-requirements-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `booking-question-dialog`, `contact-requirement-dialog`, `question-option-dialog`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

# @voyantjs/distribution-ui

Importable React UI components for Voyant distribution. Bundler-consumed (Vite, Next.js, webpack, etc.).

## Install

```bash
pnpm add @voyantjs/distribution-ui @voyantjs/distribution-react @voyantjs/ui @tanstack/react-query react react-dom
```

`@voyantjs/ui` provides the design-system primitives. `@voyantjs/distribution-react` provides the data-layer hooks. Both are required peers.

All components accept a `className` prop and merge it with `cn()`. Wrap or compose to extend; use the registry copy-paste path (`npx shadcn add @voyant/...`) for components you want to fork outright.

## Not included (registry-only)

Some components couple to TanStack Router or template-local helpers and remain available only via the shadcn registry: `booking-link-detail-page`, `channel-detail-page`, `commission-rule-detail-page`, `contract-detail-page`, `distribution-dialogs-commercial`, `distribution-dialogs-commission`, `distribution-dialogs-sync`, `distribution-dialogs-webhook`, `distribution-page`, `mapping-detail-page`, `webhook-event-detail-page`. Import via `npx shadcn add @voyant/<component>` and customize per-project.

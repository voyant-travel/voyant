# @voyant-travel/ui

Shared UI primitives for Voyant admin surfaces: the shadcn-style component set (`./components/*`), hooks, `cn`/utility helpers, and the base stylesheets (`./styles.css`, `./globals.css`) consumed by the `*-ui` domain packages and host templates.

```bash
pnpm add @voyant-travel/ui
```

Components are consumed as ordinary versioned package imports:

```tsx
import { Button } from "@voyant-travel/ui/components/button"
```

> The former shadcn registry (fork-and-own source under `registry/` plus the hosted registry worker) was removed with the packaged-admin work — see `docs/architecture/packaged-admin-rfc.md` §5. Domain UI ships from the `*-ui` packages as versioned dependencies.

## License

Apache-2.0

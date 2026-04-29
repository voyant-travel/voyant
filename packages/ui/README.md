# @voyantjs/ui

Private workspace package that holds the shadcn registry source for Voyant UI blocks.

This package is not part of the public npm surface. Public runtime behavior lives in module-specific packages such as [`@voyantjs/crm-react`](../crm-react/README.md), while this package remains the home for installable registry blocks under `registry/`.

## Publishing Flow

Registry blocks are published through the hosted registry app:

```bash
pnpm registry:build
pnpm -F @voyantjs/voyant-registry-host deploy
```

`pnpm registry:build` runs `shadcn build` for this package and copies the generated JSON payloads into `apps/registry/public/r/`, which the Cloudflare Worker serves to consumers.

## Registry Components

Install CRM components via the hosted registry:

```bash
npx shadcn@latest add https://registry.voyantjs.com/r/crm/person-list.json
```

These registry components depend on `@voyantjs/crm-react` for hooks, provider wiring, and typed client behavior.

## License

Apache-2.0

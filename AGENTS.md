# Voyant Agent Guide

This is the short operating guide for automated agents and contributors working
in this repository. Prefer the existing package patterns over new abstractions,
and promote repeated review feedback into scripts or docs.

## Repository Shape

- `packages/*` contain reusable schemas, services, routes, contracts, UI
  registries, React hooks, adapters, and runtime libraries.
- `packages/plugins/*` contain first-party integration bundles.
- `templates/*` and `apps/*` own runtime wiring, auth, deployment shape, and
  application UI.
- `examples/*` are consumer-facing reference apps.
- `docs/adr/` contains decisions. `docs/architecture/` contains active design
  rules. `UBIQUITOUS_LANGUAGE.md` contains canonical domain terms.

## Architecture Rules To Read First

- Tenant model: `docs/adr/0001-tenant-scoping.md`
- Package and schema boundaries: `docs/architecture/schema-discipline.md`
- API route conventions: `docs/architecture/api-route-authoring.md`
- Module/provider/adapter/plugin vocabulary:
  `docs/architecture/module-provider-plugin-taxonomy.md`
- Public package surface rules: `docs/frontend-package-strategy.md`

Update the relevant doc when changing an architectural rule. Add or update a
checker when a rule is mechanical enough to enforce.

## Local Verification Lanes

Use the smallest lane that matches the risk of the change:

- Fast local feedback: `pnpm verify:fast`
- Full repository confidence: `pnpm verify:full`
- Package-scoped iteration: `pnpm --filter <package> typecheck`,
  `pnpm --filter <package> test`, or `pnpm --filter <package> lint`

The fast lane runs changed-file linting plus Turbo affected typecheck/test and
architecture checks. The full lane is intended for CI, release prep, and broad
cross-package changes.

## Agent Orchestration

For agent-control-plane, remote-sandbox, browser-debugging, execution-plan, or
AI-workflow changes, read
`docs/architecture/agentic-engineering-orchestration.md` first.

## Common Commands

- Install dependencies: `pnpm install`
- Build everything: `pnpm build`
- Typecheck everything: `pnpm typecheck`
- Test everything: `pnpm test`
- Lint everything: `pnpm lint`
- Check package exports: `pnpm verify:package-exports`
- Regenerate schema docs: `pnpm generate:schema-docs`
- Build UI registry artifacts: `pnpm registry:build`

## Guardrails

- Do not add in-process tenant scoping to `packages/*`; tenancy is enforced at
  deployment boundaries.
- New package routes should use `parseJsonBody(...)` and `parseQuery(...)`
  instead of raw `c.req.json()` or manual `searchParams` parsing.
- Cross-package schema associations should go through link definitions unless
  documented as a narrow vertical-extension exception.
- Keep routes thin. Routes validate input, resolve runtime services, call domain
  services/workflows, and serialize responses.
- Avoid exposing internal helpers as public exports unless they are intended as
  supported package API.

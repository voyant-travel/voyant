# @voyant-travel/workflows-local-dashboard

The React app `voyant dev` serves at
`http://localhost:<port>/__voyant/workflows`. Embeds
`@voyant-travel/workflows-react/ui` and points at the local miniflare
orchestrator.

See [`docs/design.md`](../../docs/design.md) §7.3 and §7.7.

For browser-evidence smoke tests that do not need a live workflow server, start
the Vite preview with an empty local API fallback:

```bash
VOYANT_WORKFLOWS_DASHBOARD_EMPTY_API=1 pnpm -F @voyant-travel/workflows-local-dashboard dev:preview
```

The fallback is only installed for the Vite dev server and only when the
environment variable is set. Production builds and normal `voyant dev` serving
continue to use the real workflow API.

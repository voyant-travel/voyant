# dev

Voyant UI playground. A Cloudflare Worker + Vite + TanStack Start app (a leaner duplicate of `templates/dmc`) used for manually testing CRM UI components against a real database.

## Running

```bash
pnpm -F dev dev
```

- Worker name: `voyant-dev`
- Dev port: `3200`
- Drizzle paths resolve to `../../packages/*`

## Purpose

This app is **not** a deployable template. It exists so you can iterate on `packages/ui/`, `packages/admin/`, and registry components end-to-end without shipping changes to the DMC template.

## License

Apache-2.0

---
"@voyant-travel/admin": minor
---

Add `adminExtensionsFromGlob` + `buildAdminExtensionRoutes` — the admin-UI half of the "extend without forking" seam (Workstream C). A deployment drops an `AdminExtension` (page + widget + nav, via the existing `defineAdminExtension`) into `src/admin/<name>/index.tsx` and it's auto-discovered from a Vite `import.meta.glob` and composed into the shell:

- `adminExtensionsFromGlob(glob)` collects the default-exported `AdminExtension`s in stable order; append them to the shell's extension registry so their `navigation` and `widgets` resolve through `resolveAdminNavigation`/`resolveAdminWidgets`.
- `buildAdminExtensionRoutes(extensions, getParentRoute, runtime)` builds top-level TanStack routes from the extensions' `routes` contributions at runtime (mirrors the generated `admin.routes.generated.tsx` loop) for grafting via `attachAdminExtensionRoutes`. Discovered pages are reachable by string navigation (no typed-link map entry).

See `docs/architecture/custom-modules.md`.

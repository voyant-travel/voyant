---
"@voyantjs/admin": minor
"@voyantjs/promotions-ui": minor
---

Packaged-admin RFC Phase 2 pilot (#1643): packages can ship admin pages.

- `@voyantjs/admin`: `AdminUiRouteContribution` grows from metadata-only to
  the full route contract — optional `component`, `loader` (receives
  `{ queryClient, runtime }` with the host's baseUrl/fetcher),
  `validateSearch`, `ssr`, pending/error components, `capability`, and
  `preload`. Metadata-only contributions remain valid. New types
  `AdminRouteRuntime` and `AdminRouteLoaderContext`.
- `@voyantjs/promotions-ui`: first `@voyantjs/<domain>-ui/admin` entrypoint.
  `createPromotionsAdminExtension({ label, icon, order, path })` contributes
  the nav entry AND the route implementation (PromotionsPage +
  loadPromotionsPage + SSR mode); the host supplies only label, icon, and
  runtime.

The operator template consumes both: the local promotions extension is now a
thin call into the package, and the promotions route file is a thin host that
binds the package-owned page/loader to the file-based route tree (per-route
provider removed — the shell's VoyantReactProvider already supplies the same
context).

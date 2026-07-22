---
"@voyant-travel/admin": minor
"@voyant-travel/catalog": patch
"@voyant-travel/i18n": minor
"@voyant-travel/inventory": minor
"@voyant-travel/inventory-react": minor
---

Add the operator editorial-overlay editor for sourced products: configured-locale switching, side-by-side provider/overlay/effective comparison on wide screens with an accessible tabbed compare on narrow ones, overlay-only translation authoring, media-library-backed image overlays, customer preview, confirmed clear, and optimistic-concurrency conflict reporting.

The product editorial-overlay admin read model now enumerates every eligible field (not only fields that already carry an overlay) and reports per-field `exact`, `language-fallback`, `source-fallback`, `overlaid`, `overlay-only`, `missing`, `invalid`, and `orphaned` state plus drift against the provider's last source update, the cached source locales, and whether the entity is provider-sourced.

`useLocale()` now exposes the deployment's `supportedLocales`, and the catalog overlay service exposes `fetchOverlayRowsForEntity` for admin surfaces that need overlay audit columns.

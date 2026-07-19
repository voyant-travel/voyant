---
"@voyant-travel/apps": minor
"@voyant-travel/admin": minor
---

Render installed apps' full-page admin surfaces (`admin.pages[]`) as first-class operator sidebar entries with an icon and label, routing to `AppExtensionPage`.

- Apps: add an optional app-declared nav `icon` (HTTPS-only) to each admin page plus an app-level default `icon` on the manifest, resolved into each page at normalize time; the resolver threads the icon through `ResolvedAppPage`.
- Admin: add an optional runtime navigation hook (`AdminExtension.useRuntimeNavItems`) merged after static navigation; the shell calls it for every extension in stable order. The UI-extensions factory now contributes app-page nav entries and a single param route (`apps/$installationId/$pageKey`) that renders the matching installed page. Add `createRemoteNavIcon`, which renders the remote icon URL as a hardened `<img>` (no-referrer, lazy, decorative) with a generic lucide fallback on missing/invalid/broken images.

Pausing or uninstalling an app drops its pages from the resolver, so both the nav entry and the route target disappear on the next query.

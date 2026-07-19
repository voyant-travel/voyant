---
"@voyant-travel/apps": minor
"@voyant-travel/admin": minor
"@voyant-travel/i18n": minor
---

Render installed apps' full-page admin surfaces (`admin.pages[]`) as first-class operator sidebar entries with an icon and label, routing to `AppExtensionPage`.

- Apps: add an optional app-declared nav `icon` (HTTPS-only) to each admin page plus an app-level default `icon` on the manifest, resolved into each page at normalize time; the resolver threads the icon through `ResolvedAppPage`.
- Admin: add an optional runtime navigation hook (`AdminExtension.useRuntimeNavItems`) merged after static navigation; the shell calls it for every extension in stable order. The UI-extensions factory now contributes app-page nav entries and a single param route (`apps/$installationId/$pageKey`) that renders the matching installed page. Add `createRemoteNavIcon`, which renders the remote icon URL as a hardened `<img>` (no-referrer, lazy, decorative) with a generic lucide fallback on missing/invalid/broken images. The app-page route's "unavailable" copy is localized via the operator admin messages catalog, and its static route title accepts an optional localized `labels` override.
- i18n: add `appPageTitle` and `appPageUnavailable` operator admin chrome messages (en + ro).

Pausing or uninstalling an app drops its pages from the resolver, so both the nav entry and the route target disappear on the next query.

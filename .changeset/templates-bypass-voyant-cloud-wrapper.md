---
"@voyantjs/voyant-cloud": patch
---

Templates (`dmc`, `operator`) now depend on `@voyantjs/cloud-sdk` directly instead of going through the `@voyantjs/voyant-cloud` wrapper. The wrapper added one ~30-line env helper (`getVoyantCloudClient(env)`) that's now inlined per template at `src/lib/cloud-client.ts`. The SDK is the source of truth — no reason to wrap it.

**Why this change:**
- `@voyantjs/voyant-cloud` has been failing to publish on npm for several release cycles (`E404 Not Found - PUT`). Templates can't depend on a package that doesn't exist on npm. Removing the dep unblocks every consumer of these templates.
- The wrapper didn't add functionality — `getVoyantCloudClient` is 30 lines of env reading + validation. Easier to inline than to maintain a separate published package.

**What templates do now:**
- `src/lib/cloud-client.ts` — local `getVoyantCloudClient(env)` and `tryGetVoyantCloudClient(env)`, identical behavior to the old wrapper
- All template-side imports of `@voyantjs/voyant-cloud` (notifications, brochure-printer, video-uploads, invitations, auth handler) updated to import from `./cloud-client.js`
- `package.json` dep swap: `@voyantjs/voyant-cloud` → `@voyantjs/cloud-sdk@^0.4.0`

The `@voyantjs/voyant-cloud` workspace package itself is left in place for non-template consumers (e.g., `@voyantjs/notifications`, `@voyantjs/plugin-netopia`), but its publish status is no longer load-bearing for templates.

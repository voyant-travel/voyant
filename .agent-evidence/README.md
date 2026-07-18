# Browser evidence — Remote App Platform Phase 3 (voyant#3440)

Captured from the `@voyant-travel/admin-extension-sdk` host harness, which
mounts the **real** `UiExtensionHost` from `@voyant-travel/admin` against a demo
extension bundle in a browser (no `allow-same-origin`, unchanged sandbox
posture).

Reproduce:

```sh
node packages/admin-extension-sdk/harness/build.mjs
node packages/admin-extension-sdk/harness/serve.mjs   # http://localhost:5271
```

## Screenshots

- `01-host-overview.png` — the four host scenarios before interaction.
- `02-session-token-granted.png` — after clicking "Request session token" in
  scenario 1.

Both frames render through the sandboxed iframe host and show the extension API
negotiated at **v1.1.0**.

### What each scenario demonstrates

1. **Rendered slot extension + session-token broker** — a slot extension mounted
   from a descriptor. The frame shows the resolved **app locale (`en`)** and
   **direction (`ltr`)** delivered at init, and after pressing *Request session
   token* the frame receives a short-lived grant (`Granted · id st_demo_1`) over
   the reserved `request-token` → `session-token` protocol. The host action log
   records the issuance. Only the token flows to the frame — no installation
   credential.
2. **Incompatible version (fail-soft)** — a `^2` extension against admin `1.1.0`
   renders a quiet incompatible card and never mounts a frame.
3. **Handshake timeout (fail-soft)** — a dead/slow app origin degrades to the
   existing error card ("could not be loaded and was skipped") and never blocks
   the surrounding native admin.
4. **Full-page app extension (RTL app locale)** — a full-page extension under an
   app-owned admin route (`page:/settings`), rendered through the same sandboxed
   host with the frame filling height, showing a resolved **app locale `ar`** and
   **direction `rtl`**.

Server-side resolution (active-installations-only sourcing, `extensionApi`
compatibility filtering, host-label + locale/direction resolution) and the
session-token issuance/exchange + replay guard are covered by unit tests in
`packages/apps/src/*.test.ts` and `packages/admin-extension-sdk/tests/`.

---

# Browser evidence — App governance & developer UI (voyant#3439)

Screenshots (`0[1-8]-*.png`) of the `@voyant-travel/apps-react` surfaces driven
in a real Chrome browser against the **actual** exported components and
react-query hooks. The full seeded operator deployment depends on the
app-registry backend seed work (this slice is *Blocked by #3438*), so the UI was
exercised through a self-contained Vite harness that mounts the shipped
components (`InstalledAppsPage`, `InstallationDetail`, `ConsentScreen`,
`DeveloperAppsPage`) behind a mock fetcher whose responses match the
`/v1/admin/apps/*` envelopes the hooks validate with Zod. Only the HTTP layer is
stubbed — components, hooks, i18n, and styling are the real ones, at realistic
data density.

The harness scaffolding is intentionally not committed (evidence directories
carry screenshots, not linted/tested tooling): a Vite entry renders each
exported `@voyant-travel/apps-react` component with a `fetch` mock returning the
validated `/v1/admin/apps/*` response envelopes.

## Screenshots

- `01-installed-apps-list.png` — Installed Apps list (active / paused / uninstalled).
- `02-installation-detail.png` — detail overview: pending release, blocked update
  reason, namespace-filtered link to app-owned custom-field definitions.
- `03-scopes-granted-optional-revoked.png` — Scopes tab: granted / optional / revoked.
- `04-webhook-health.png` — Webhooks tab: active vs. failed subscription health.
- `05-consent-screen.png` — consent: required + optional grants for the selected
  release (4 scopes).
- `06-consent-optional-denied.png` — denying one optional scope reduces the
  granted list (4 → 3).
- `07-developer-releases-credentials.png` — developer surface: client credentials,
  restricted installation link, releases.
- `08-developer-create-app.png` — create custom-app registration dialog.

Installation lifecycle (install/pause/resume/uninstall/activate), the read-model
aggregation, and purge preview are additionally covered by the route integration
tests in `packages/apps/src/installation-routes.test.ts` and the package unit
tests in `packages/apps-react/src/schemas.test.ts`.

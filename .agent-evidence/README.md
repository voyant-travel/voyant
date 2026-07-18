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

# admin-extension-sdk harness (dev-only)

A tiny, **private** harness used to eyeball the UI-extension host end to end in a
real browser. Not published, not part of the package build.

- `extension/` — a minimal demo extension (plain HTML + TS) that uses the SDK
  via `initUiExtension`, renders the host context, and exercises the toast +
  navigate actions.
- `host/` — a standalone page that mounts the real `UiExtensionHost`
  (`@voyant-travel/admin`) against the demo bundle in three states: rendered
  with context, incompatible version, and handshake timeout. Navigations and
  toasts are logged on the page.

## Run

```sh
node harness/build.mjs      # bundle host + extension into harness/public
node harness/serve.mjs      # serve harness/public on http://localhost:5271
```

Screenshots captured from this harness live in `.agent-evidence/` on the
branch.

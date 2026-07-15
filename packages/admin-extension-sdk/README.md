# @voyant-travel/admin-extension-sdk

The versioned contract and author client for Voyant **admin UI extensions** — a
tiny, dependency-free package shared by the admin host, the cloud platform, and
extension authors.

It exports:

- `ADMIN_UI_EXTENSION_API_VERSION` — the semver the host implements.
- The shared value types (`UiExtensionContext`, `UiExtensionDescriptor`, …).
- The `postMessage` protocol: message types, creators, and type guards.
- `initUiExtension(options?)` — the author client that runs inside the
  sandboxed extension frame, performs the host handshake, and returns a handle
  exposing the context/config plus `navigate` / `toast` / `resize` actions
  (with automatic height reporting).

```ts
import { initUiExtension } from "@voyant-travel/admin-extension-sdk"

const handle = await initUiExtension()
handle.onContextChange((context) => applyTheme(context.theme))
handle.actions.toast("success", `Hello ${handle.context.viewer.displayName}`)
```

The host side (slot registry, `UiExtensionHost`, the admin-extension factory)
lives in `@voyant-travel/admin`. See
`docs/architecture/admin-ui-extensions.md` for the authoring guide, protocol
reference, and versioning policy.

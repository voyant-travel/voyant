---
"@voyant-travel/admin": minor
---

Source admin extensions from active app installations and complete the iframe
session-token host flow (RFC Phase 3). Adds an installation-backed
`UiExtensionsClient` (`createInstallationUiExtensionsClient`) alongside the
static one; wires the reserved `request-token` message to an environment token
broker (host answers `not-supported` without one, `unavailable` on failure);
passes the resolved app locale + text direction to each frame at init and on
change; and adds full-page app extensions (`AppExtensionPage`) with navigation
contributions rendered through the unchanged sandboxed host (no
`allow-same-origin`). The extension API moves to `1.1.0`.

---
"@voyant-travel/media": patch
---

Declare the media module's `meta.agentTools` posture as `not-applicable`. The
media library exposes an admin catalogue surface only; byte upload/serve
mechanics and any future media Tools remain owned by `@voyant-travel/storage`,
so the module carries no agent Tools. This satisfies the agent-tool-coverage
check, which requires every Tool-less module to declare an explicit posture and
rationale.

---
"@voyant-travel/framework": minor
---

`@voyant-travel/framework` now owns the standard runtime composition manifest (`FRAMEWORK_RUNTIME_MANIFEST` — the ordered 21 package modules + 8 package extensions). The operator deployment spreads it and appends only its deployment-local `operator/*` families, so adding a standard module to the framework auto-joins the default set without the deployment re-listing it. First slice of Workstream B (the standard composition relocation); the registry factories relocate next.

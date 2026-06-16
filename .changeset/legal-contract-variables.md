---
"@voyant-travel/legal": minor
---

The legal module now owns contract-template variable building: new export
`buildContractVariableBindings(options)` (from `@voyant-travel/legal` and
`./contract-variables`). The deployment injects only its operator-settings reads
(operator profile / payment instructions / policy source); the cross-module
variable assembly (payment schedule, rooms summary, customer hydration) no longer
lives in the deployment.

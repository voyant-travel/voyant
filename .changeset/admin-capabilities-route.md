---
"@voyantjs/hono": minor
---

Add the admin capability-discovery route — `GET /v1/admin/_meta/capabilities`.

`createApp` now serves a built-in capabilities route (under the `/v1/admin/*`
staff guard) when the deployment supplies the operation catalogue via the new
`adminMeta` config: `{ contractVersion, deploymentVersion?, operations }`. It
returns the enabled modules, the operation catalogue, the contract/deployment
version, and the caller's resolved actor + scopes — so the admin SDK's
`client.capabilities()` returns live data.

`adminMeta` is typed structurally, so `@voyantjs/hono` stays decoupled from
`@voyantjs/admin-contracts`; deployments inject the catalogue from
`admin-contracts`' `ADMIN_CONTRACT_VERSION` + `operationCapabilities()`. When
`adminMeta` is omitted, the route is not mounted. Wired in `templates/dmc` as the
reference. (#1411 roadmap item 1.)

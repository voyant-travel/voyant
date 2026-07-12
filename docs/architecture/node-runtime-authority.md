# Generic Node Runtime Authority

Voyant application graphs execute in a resident Node process. The public boot
boundary is `@voyant-travel/framework/node-runtime`; generated project and
deployment artifacts provide its admitted `VoyantGraphRuntime`, deployment
mode/providers, deployment requirements, and runtime-port implementations.

`packages/operator-runtime` is a generic generated-project host. It may verify
the generated graph hash and serve the packaged admin application, but it must
not reconstruct `voyant.managed-profile.v1`, select an Operator profile, or
infer package/runtime membership outside the generated graph.

The Node runtime owns process environment adaptation, graph value resolution,
runtime composition, route posture, provider defaults, and the resident HTTP
server. Its deployment contract intentionally has no edge/Workers target:
unified Voyant applications remain Node-only, while independently deployed
storefront and federated surfaces keep their existing target-specific hosts.

## Compatibility Boundary

`@voyant-travel/framework/managed-runtime`, `managed-jobs`, and the
`profile`/`profile-types` contract remain temporarily published for existing
snapshot-generated deployments and Cloud callers. New generated application
artifacts must not depend on those entries. The v1 deployment-artifact manifest
still carries its `profileSnapshot` field so older readers remain compatible,
but the generated Node entry does not read that snapshot to boot.

`scripts/check-node-runtime-authority.mjs` enforces the public subpath, direct
graph boot in generated entries, and the absence of managed-profile synthesis
from `packages/operator-runtime`.

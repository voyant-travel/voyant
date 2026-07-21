---
"@voyant-travel/storage": minor
"@voyant-travel/framework": minor
---

Add a selectable `gateway` object-storage provider. Managed deployments can now
resolve their `media`/`documents` stores through the platform asset-storage
gateway (via the existing `createGatewayStorageProvider`) instead of holding raw
bucket credentials: both stores talk to `STORAGE_GATEWAY_ENDPOINT` with a
workspace-scoped `STORAGE_GATEWAY_TOKEN` bearer token, and the gateway brokers
R2 access scoped to the caller's `<jurisdiction>/<org>` prefix.

The storage manifest exposes the provider under `selection { role: "storage",
value: "gateway" }`, and the Node runtime provider plan accepts `storage:
"gateway"` (requiring `STORAGE_GATEWAY_ENDPOINT` + `STORAGE_GATEWAY_TOKEN`) and
maps it to the `object-storage` deployment resource. Self-hosters are
unaffected — they continue to use `s3-compatible` or the local memory provider,
with no token.

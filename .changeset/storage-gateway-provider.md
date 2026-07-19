---
"@voyant-travel/storage": minor
---

Add a generic `gateway` storage provider: an HTTP client that implements the
`StorageProvider` interface by calling a configured storage-gateway endpoint
with a bearer token.

- `createGatewayStorageProvider({ endpoint, token, fetch?, name? })` speaks a
  small object API under `/v1/objects` — `PUT` to upload, `GET` to fetch bytes
  (404 → `null`), `DELETE` to remove (404 treated as a no-op), and
  `POST .../signed-url` to mint a time-limited download URL.
- Every request carries `Authorization: Bearer ${token}`. The token is opaque:
  the provider never parses it and leaves scope resolution to the gateway. A
  `401` raises a clear auth error; other non-2xx responses surface the status
  and a body snippet.
- Path segments are URL-encoded individually so keys containing `/` route
  correctly, while keys are otherwise passed through untouched.
- The factory and its `GatewayStorageProviderOptions` type are exported from the
  package root and via the `./providers/gateway` subpath.

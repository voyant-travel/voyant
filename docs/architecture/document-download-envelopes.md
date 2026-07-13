# Document Download Envelopes

Document-producing admin routes should return a response-local `download`
envelope when the freshly-created stored document has a resolvable URL.

The envelope is intentionally separate from durable attachment or rendition
rows:

```json
{
  "download": {
    "url": "https://signed-url.example/document.pdf",
    "expiresAt": "2026-05-23T16:00:00.000Z",
    "filename": "document.pdf"
  }
}
```

`url` is ephemeral and may be a signed storage URL. `expiresAt` is `null` when
the signer does not expose an expiry. `filename` should come from the stored
document row when available, then metadata, then the storage key basename.

Routes must resolve envelopes through `resolveStoredDocumentDownload(...)` from
`@voyant-travel/hono`. That helper centralizes resolver precedence, metadata
fallbacks, filename derivation, and the `resolver_not_configured` state used by
redirect-style download routes.

For private documents served through an authenticated application route, use
the selected provider's optional signer or wire `resolveDocumentDownloadUrl` with
`createAuthenticatedDocumentDownloadResolver(...)` instead:

```ts
import { createAuthenticatedDocumentDownloadResolver } from "@voyant-travel/hono/document-download"

const resolveDocumentDownloadUrl = createAuthenticatedDocumentDownloadResolver({
  apiBaseUrl: (bindings) => bindings.API_BASE_URL,
  routePrefix: "/v1/admin/documents/files",
  isAvailable: () => true,
})
```

The resolver returns the authenticated application route and encodes each
storage-key path segment independently, so folder structure is preserved.
`publicUrl()` is only for permanent unauthenticated URLs and is not appropriate
for sensitive documents.

Generation routes omit `download` when no URL can be resolved. Redirect-style
`/download` routes may convert `resolver_not_configured` into `501` and
`not_available` into `404`.

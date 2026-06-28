# @voyant-travel/storage

Storage provider abstraction for Voyant. `StorageProvider` interface plus providers for local (in-memory), Cloudflare R2, and S3-compatible (AWS SigV4 via Web Crypto — works in Cloudflare Workers).

## Install

```bash
pnpm add @voyant-travel/storage
```

## Usage

```typescript
import { createStorageService } from "@voyant-travel/storage"
import { s3Provider } from "@voyant-travel/storage/providers/s3"

const storage = createStorageService(
  s3Provider({
    region: "us-east-1",
    bucket: "my-bucket",
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  }),
)

await storage.upload({ key: "files/x.pdf", body: buffer })
const url = await storage.signedUrl({ key: "files/x.pdf", expiresIn: 300 })
```

The S3 provider supports `forcePathStyle` and a custom `endpoint` for S3-compatible services (Wasabi, MinIO, etc.). SigV4 signing is verified against AWS canonical test vectors.

The R2 binding provider cannot mint signed URLs by itself. Configure either
`publicBaseUrl` or a custom `signer` before calling `signedUrl`; otherwise the
provider throws instead of returning a raw storage key.

For private R2 documents that should be downloaded through an authenticated
application route, do not use `publicUrl()` or call `signedUrl()` without a real
signer. Wire the route-level `resolveDocumentDownloadUrl` callback with the
shared Hono helper instead:

```typescript
import { createAuthenticatedR2DocumentDownloadResolver } from "@voyant-travel/hono/document-download"

const resolveDocumentDownloadUrl = createAuthenticatedR2DocumentDownloadResolver({
  apiBaseUrl: (bindings: { API_BASE_URL?: string; DOCUMENTS_BUCKET?: unknown }) =>
    bindings.API_BASE_URL ?? null,
  routePrefix: "/v1/admin/documents/files",
  bucketBindingName: "DOCUMENTS_BUCKET",
})
```

That returns an authenticated Worker/app URL such as
`https://api.example.com/v1/admin/documents/files/contracts/invoice.pdf` while
preserving folder segments in the storage key.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./types` | `StorageProvider` interface |
| `./service` | `createStorageService` |
| `./providers/local` | In-memory provider |
| `./providers/r2` | Cloudflare R2 binding provider |
| `./providers/s3` | S3 provider with SigV4 |
| `./lib/sigv4` | `signRequest`, `presignUrl` primitives |

## License

Apache-2.0

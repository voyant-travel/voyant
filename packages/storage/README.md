# @voyantjs/voyant-storage

Storage provider abstraction for Voyant. `StorageProvider` interface plus providers for local (in-memory), Cloudflare R2, and S3-compatible (AWS SigV4 via Web Crypto — works in Cloudflare Workers).

## Install

```bash
pnpm add @voyantjs/voyant-storage
```

## Usage

```typescript
import { createStorageService } from "@voyantjs/voyant-storage"
import { s3Provider } from "@voyantjs/voyant-storage/providers/s3"

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

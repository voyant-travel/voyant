# @voyant-travel/storage

Vendor-neutral object storage contracts and built-in Node providers for Voyant.

## Providers

- `memory` keeps objects in process for local development and tests.
- `s3-compatible` uses AWS SDK v3 for AWS S3 and compatible services such as
  Cloudflare R2, Google Cloud Storage's XML API, and MinIO.
- `custom` loads a selected `storage.object` provider from an adapter package.

Deployments select the provider through `deployment.providers.storage`.
Credentials configure the selected provider; their presence never changes the
selection. Application code resolves logical `media` and `documents` stores and
does not depend on vendor bucket bindings.

```typescript
import { createS3CompatibleStorageProvider } from "@voyant-travel/storage/providers/s3-compatible"

const documents = createS3CompatibleStorageProvider({
  region: "us-east-1",
  bucket: "documents",
  // endpoint and explicit credentials are optional for normal AWS SDK resolution.
})
```

Adapter packages can verify custom implementations with
`assertStorageProviderConformance` from `@voyant-travel/storage/conformance`.
They declare the provider in their package-owned Voyant manifest:

```typescript
import { definePlugin } from "@voyant-travel/core/project"

export default definePlugin({
  id: "@acme/voyant-storage",
  config: [
    { id: "@acme/voyant-storage#config.endpoint", key: "STORAGE_ENDPOINT" },
  ],
  secrets: [
    { id: "@acme/voyant-storage#secret.token", key: "STORAGE_TOKEN", required: true },
  ],
  providers: [
    {
      id: "@acme/voyant-storage#provider.custom",
      port: "storage.object",
      selection: { role: "storage", value: "custom" },
      uses: {
        config: ["@acme/voyant-storage#config.endpoint"],
        secrets: ["@acme/voyant-storage#secret.token"],
      },
      runtime: {
        entry: "@acme/voyant-storage/provider",
        export: "createStorageResolver",
      },
    },
  ],
})
```

The factory returns a `StorageProviderResolver`. Boot fails when `custom` is
selected but the graph has no matching provider. Embedded hosts and tests may
still pass an explicit resolver through
`createVoyantProjectServerEntry({ host: { storage } })`.

Provider factories may read only the unit-owned config, secret, and resource
declaration IDs listed in `uses`. Port-scoped boot therefore does not validate
unrelated settings from a multi-provider plugin package.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Storage contracts and service helpers |
| `./types` | `StorageProvider` and `StorageProviderResolver` |
| `./conformance` | Portable provider conformance runner |
| `./providers/local` | In-memory provider |
| `./providers/s3-compatible` | AWS SDK v3 S3-compatible provider |

## License

Apache-2.0

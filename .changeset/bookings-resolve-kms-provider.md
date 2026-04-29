---
"@voyantjs/bookings": minor
---

`createBookingsHonoModule(options)` now accepts a `resolveKmsProvider` factory so apps can source the booking-PII KMS key from Vault (or any other secret store) instead of being forced to populate `KMS_*` env vars:

```ts
bookingsHonoModule({
  resolveKmsProvider: async (env) => {
    const cloud = getVoyantCloudClient(env)
    const secret = await cloud.vault.getSecret("booking-pii", "kms-key")
    return new EnvKmsProvider({ key: secret.value })
  },
})
```

`getKmsProvider()` on the route runtime now returns `Promise<KmsProvider>` (always async) so the resolver can be sync or async. The default `createKmsProviderFromEnv` path is unchanged for callers that don't pass options.

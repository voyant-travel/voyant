---
"@voyant-travel/distribution": minor
---

Emit `product.publication.changed` on every product↔channel mapping mutation.

The distribution service now emits a durable `product.publication.changed`
domain event from the service layer whenever a channel product mapping is
created, updated, deleted, activated, or deactivated — including the
batch-update / batch-delete paths, which fan out over the same single-item
service methods. The payload carries `productId`, `channelId`, `mappingId`,
the previous and new mapping active state, the operation source
(`created | updated | deleted | activated | deactivated`), and the channel
`kind` / `status` at emit time.

This lets catalog / storefront integrations reindex a product's
customer-facing slices the moment its publication changes (adding an active
mapping to an active channel makes it listable; deactivating or removing one
should tombstone the slice), instead of waiting for an unrelated product
mutation or a manual reindex. Emission is fire-and-forget and never throws,
per the EventBus contract.

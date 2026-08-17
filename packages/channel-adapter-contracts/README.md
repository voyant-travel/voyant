# Channel adapter contracts

`@voyant-travel/channel-adapter-contracts` is the public, provider-neutral seam
for adding a custom communications transport to a Voyant deployment. It contains
DTO schemas, the adapter interface, capability negotiation, a reusable
conformance runner, and a deterministic fixture adapter.

The package does not own Inbox or Notifications runtime ports. Those domain
packages remain responsible for transactions, durable delivery state, replay
ledgers, suppression, conversation threading, and authorization. An adapter
translates between those ports and one external transport.

## Boundary

- Adapter credentials and configuration remain inside the adapter deployment.
- The host stores only an opaque `adapterAccountRef`.
- Outbound submission returns `accepted`, never a premature `delivered` result.
- Inbound ingestion is pull-based: `listInbound`, `fetchInbound`, then `ackInbound`.
  The adapter must retain an item until acknowledgement succeeds.
- Inbound-message and lifecycle-webhook authenticity are decided by the adapter.
  The contract requires a fail-closed result but intentionally does not prescribe
  an algorithm.
- Attachments cross the boundary as private handles and are read as byte streams.
  Signed URLs, buffered payload requirements, and raw secrets are not durable
  contract values.
- Channel identifiers are open strings. Support is negotiated from capabilities.

## Setup

Call `validateChannelAdapter` when loading an adapter, then
`negotiateChannelAdapter` for the channel and capabilities required by a Channel
Account. If `accountValidation` is available, call `validateAccount` before
enabling the account. A disabled or incompatible account must remain unavailable
for admission.

```ts
import {
  CHANNEL_ADAPTER_PROTOCOL_VERSION,
  negotiateChannelAdapter,
} from "@voyant-travel/channel-adapter-contracts/v1"

negotiateChannelAdapter(adapter, {
  protocolVersion: CHANNEL_ADAPTER_PROTOCOL_VERSION,
  channel: "email",
  capabilities: ["outbound", "inbound", "health"],
})
```

## Conformance

Custom adapter repositories should run `runChannelAdapterConformance` in CI.
The suite verifies capability truthfulness, authenticity rejection, replay and
payload-drift behavior, fetch/ack crash safety, lifecycle normalization, and
health transitions. `FixtureChannelAdapter` can be used for host integration
tests without network access.

Channel-specific policy suites may extend the base runner. In particular,
telephone-number normalization, message segmentation, opt-out keywords, and
adapter-handled automatic responses belong to a future SMS conformance extension;
they are not inferred by this channel-neutral contract.

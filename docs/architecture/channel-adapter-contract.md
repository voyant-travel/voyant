# Custom channel adapter contract

## Decision

Third-party communications transports integrate through the publishable,
provider-neutral `@voyant-travel/channel-adapter-contracts` package. A deployment
selects exactly one adapter bundle for a configured Channel Account. Provider
implementations are deployment wiring, not part of the Inbox or Notifications
domain packages.

The contract package is dependency-light and contains no runtime module. It may
define transport DTOs and adapter conformance tools, but it must not take ownership
of domain runtime ports. Notifications owns durable outbound admission, delivery
state, Channel Accounts, suppression, and lifecycle reconciliation. Conversations
owns inbound idempotency, threading, parts, and staff replies.

## Protocol and capability negotiation

An adapter declares the `channel-adapter.v1` protocol and an explicit capability
set per channel. Channel names are open strings so later transports do not require a breaking
contract release. At startup the deployment validates that every declared
capability exactly matches an implemented method. Channel Account setup then
negotiates its required channel and capabilities and, where supported, validates
the opaque account reference before activation.

A capability is a promise, not UI metadata. Claiming inbound support requires
list, fetch, acknowledge, and authenticity verification. Claiming lifecycle
support requires durable list/fetch/ack plus normalization to the shared delivery states. Missing or
contradictory capabilities fail setup closed.

`@voyant-travel/communications-adapter-runtime` is the graph bridge. One selected
bundle is validated before activation, then fanned into Notifications durable
delivery and lifecycle ports plus Conversations ingress. Health affects dispatch
and polling; an unavailable account is never used.

## Secrets and private content

Credentials, endpoints, signing material, and adapter configuration never cross
the public contract. They remain inside deployment-owned adapter wiring. The host
stores only an opaque adapter account reference and must not render it as a secret
configuration viewer.

Attachments use account/source-scoped ephemeral handles and stream byte chunks when resolved.
Neither signed URLs, whole buffered payloads, nor credentials are persisted in
adapter DTOs. The domain runtime resolves a private handle at use time and remains
responsible for authorization, scanning, retention, and redaction.

## Outbound and inbound guarantees

Outbound submission is idempotent by `operationId`. A successful call means the
external transport accepted responsibility; later lifecycle events establish
delivered, failed, bounced, complained, or suppressed truth.

Inbound processing is pull-based even when a webhook wakes the worker:

1. atomically reject unauthentic raw bytes before they enter either queue;
2. list opaque item references;
3. fetch and validate a normalized envelope;
4. commit the conversation part and replay identity in one domain transaction;
5. acknowledge only after commit.

An item remains available after fetch until acknowledgement. Repeating an event
or envelope identity with the same canonical payload is a harmless duplicate;
reusing it with different content is payload drift and fails closed.

## Conformance boundary

The base conformance runner is transport-neutral. It covers protocol negotiation,
capability truthfulness, invalid-authenticity rejection without prescribing a
signature algorithm, duplicate replay, payload drift, fetch/ack crash safety,
delivery normalization, private DTO shape, and health transitions.

SMS extends the same contract with strict E.164 addresses, GSM 03.38/UCS-2
segmentation, hard-opt-out/opt-in events, adapter-handled policy responses, and
per-channel multimedia negotiation.

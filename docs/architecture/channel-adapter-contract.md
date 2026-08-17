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
set. Channel names are open strings so later transports do not require a breaking
contract release. At startup the deployment validates that every declared
capability exactly matches an implemented method. Channel Account setup then
negotiates its required channel and capabilities and, where supported, validates
the opaque account reference before activation.

A capability is a promise, not UI metadata. Claiming inbound support requires
list, fetch, acknowledge, and authenticity verification. Claiming lifecycle
support requires normalization to the shared delivery states. Missing or
contradictory capabilities fail setup closed.

## Secrets and private content

Credentials, endpoints, signing material, and adapter configuration never cross
the public contract. They remain inside deployment-owned adapter wiring. The host
stores only an opaque adapter account reference and must not render it as a secret
configuration viewer.

Attachments use stable private handles and stream byte chunks when resolved.
Neither signed URLs, whole buffered payloads, nor credentials are persisted in
adapter DTOs. The domain runtime resolves a private handle at use time and remains
responsible for authorization, scanning, retention, and redaction.

## Outbound and inbound guarantees

Outbound submission is idempotent by `operationId`. A successful call means the
external transport accepted responsibility; later lifecycle events establish
delivered, failed, bounced, complained, or suppressed truth.

Inbound processing is pull-based even when a webhook wakes the worker:

1. reject an unauthentic inbound-message or lifecycle-event request;
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

Channel-specific semantics extend this suite rather than weakening the base
contract. SMS number normalization, segmentation, opt-out/opt-in behavior, and
adapter-handled automatic replies are intentionally deferred to an SMS extension.

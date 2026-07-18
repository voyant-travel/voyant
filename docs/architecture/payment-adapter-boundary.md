# Payment adapter boundary

Payment processors are deployment adapters, not remote apps. The canonical
adapter contract lives in `@voyant-travel/payments`, while finance remains the
owner of payment-session, invoice, payment, and checkout state.

The deployment selects one active adapter through
`deployment.providers.payments`. Environment variables configure the selected
adapter; their presence never selects a processor. The V1 provider values are:

- `voyant-payments`
- `netopia`
- `custom`
- `none`

`none` is valid only for deployments without payment-capable graph units.
Payment-capable graphs, including finance payment-session capability, must
select exactly one active adapter. `custom` is reserved for operator-owned
adapters that satisfy the public conformance kit.

Adapter packages expose a provider facet with `selection.role: "payments"` and
the matching `selection.value`. The graph resolver rejects zero or multiple
matching provider facets for a concrete selected adapter.

`@voyant-travel/payments` exports:

- the runtime adapter port;
- declared processor capabilities;
- hosted checkout / redirect initiation;
- authorize, capture, void, refund, and status operation contracts;
- callback signature verification and canonical event mapping;
- idempotency and retry expectations;
- health diagnostics and sandbox/test-mode declaration;
- conformance helpers for money handling, state transitions, duplicate/replay
  callbacks, signature failure, idempotency, and failure posture.

The existing finance `CardPaymentStarter` seam remains as the checkout bridge.
Deployments can adapt a selected `PaymentAdapter` through
`createPaymentAdapterCardPaymentStarter(...)`, and verified callback events are
applied to the finance payment-session state machine through
`applyPaymentAdapterCallbackEvent(...)`.

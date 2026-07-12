# @voyant-travel/webhook-delivery

Node-host outbound webhook delivery behind the Framework's selected-event
enqueue boundary. The package owns subscription fan-out, visibility policy,
HMAC signing, persisted attempts, idempotency, bounded retries, terminal
dead-letter state, and delivery audit outcomes.

The audit tables intentionally contain only redacted, bounded excerpts. The
original event payload remains at the host enqueue boundary and is never used
as an audit-storage surrogate.

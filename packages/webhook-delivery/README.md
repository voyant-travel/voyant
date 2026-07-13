# @voyant-travel/webhook-delivery

Node-host outbound webhook delivery behind the Framework's selected-event
enqueue boundary. The package owns subscription fan-out, visibility policy,
HMAC signing, persisted attempts, idempotency, bounded retries, terminal
dead-letter state, and delivery audit outcomes.

The audit tables intentionally contain only redacted, bounded excerpts. The
original event payload remains at the host enqueue boundary and is never used
as an audit-storage surrogate.

Deployment graphs select enqueue authority explicitly through
`deployment.providers.outboundWebhooks`: `postgres` uses this package's durable
Postgres adapter, `host` delegates to an injected host callback, and `none`
omits outbound subscriber composition. Enqueue selection does not schedule the
HTTP delivery worker; worker triggering remains a separate Node deployment
responsibility.

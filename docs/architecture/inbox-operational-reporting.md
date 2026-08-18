# Inbox operational reporting

Inbox search, queues, and reports execute inside the deployment's tenant database. Customer
addresses, subjects, and message bodies are not copied into the deployment-wide catalog,
search plane, telemetry labels, or reporting events. Search only considers authorized Inbox
memberships and excludes quarantined or redacted Part content.

Queue projections are durable fields on `conversations`, maintained in the same transaction as
the Part or lifecycle Event that changes them. They are rebuildable from Parts and Events and
exist to make the operator's day-to-day queues indexable; they are not a second source of truth.

## SLA semantics

The first reporting surface is explicitly **non-authoritative** for contractual SLAs:

- clocks use elapsed wall time, not configured business hours;
- the clock starts at Conversation creation;
- snoozing does not pause a clock;
- reopening clears the previous resolution projection but continues from the original clock;
- `waiting_on_staff` starts with the latest inbound customer Part, and `waiting_on_customer`
  starts with the latest outbound staff Part;
- first response is the first outbound Part at or after the first inbound Part;
- resolution is the latest transition to closed.

The API returns these semantics with every report. An authoritative SLA display must wait for a
separate decision and configuration model covering calendars, time zones, holidays, pause rules,
and reopen policy.

## Content-free observability

Ingress lag uses only operation timestamps. Delivery failure and suppression metrics use status
counts. Metric dimensions may include channel and coarse lifecycle state, but never addresses,
subjects, message text, attachment names, Person identifiers, or Conversation identifiers.

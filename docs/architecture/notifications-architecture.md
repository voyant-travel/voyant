# Voyant Notifications Architecture

This guide defines how Voyant should treat notifications as an infrastructure
capability.

The goal is simple:

- keep one canonical notification send model
- keep providers and channels explicit
- let workflows and routes trigger delivery through the same shared surface
- keep notification transport separate from CRM/history concerns

Notifications should be an infrastructure module, not a collection of package-
local delivery patterns.

For active guidance on event emission semantics and when delivery should move to
durable jobs or workflows, see
[`event-delivery-and-durable-execution-policy.md`](./event-delivery-and-durable-execution-policy.md).

## Core Rules

### 1. Keep one canonical send model

Voyant should have one main notification send surface that delivery callers use.

Specialized sends may still exist for convenience, such as:

- invoice notifications
- payment-session notifications
- reminder-driven sends
- booking-document sends

But they should read as orchestration wrappers over one shared notification
service, not as separate notification systems.

Rule:

Specialized sends should compose the core notification service instead of
bypassing it.

### 2. Keep the core payload small and provider-agnostic

The shared notification payload should stay centered on:

- recipient
- channel
- template
- data

Optionally, it may also carry rendered transport fields such as:

- subject
- text
- html

Provider-specific details should stay inside provider adapters, not in feature
modules.

Rule:

The notification payload should describe the delivery intent, not the provider’s
internal API shape.

### 3. Resolve delivery primarily by channel

Provider selection should normally happen through the delivery channel and the
registered provider set.

Examples:

- email
- sms
- push
- webhook-like delivery surfaces if Voyant ever supports them

That keeps feature modules from hardcoding vendor logic.

Rule:

Feature code should choose a channel. Provider resolution should happen in the
notification infrastructure layer.

## Providers And Delivery

### 4. Providers are transport implementations

Notification providers should be responsible for:

- formatting transport-specific requests
- sending through the vendor API
- returning delivery results in the shared provider shape

They should not own product-specific business rules.

Rule:

Notification providers implement transport delivery, not feature logic.

### 5. Notification delivery is infrastructure, not CRM history

Voyant notifications should focus on transport and delivery concerns:

- what was sent
- through which channel
- by which provider
- with what result

If a product needs customer-relationship history or communication timelines,
that belongs in a higher-level product surface, not the transport layer itself.

Rule:

Do not overload the notifications module into a full communication-history
system by default.

## Workflows And Triggers

### 6. Workflows should trigger notifications through the shared surface

Workflows are a natural place to trigger:

- reminders
- follow-ups
- approval results
- payment or booking communications

They should call the shared notification surface instead of open-coding
provider-specific delivery.

Rule:

Workflow-triggered notifications should still flow through the same core
notification service.

### 7. Routes and subscribers may also trigger notifications

Notifications do not need to come only from workflows.

Routes and subscribers may also trigger delivery when appropriate, but the send
path should still remain the shared notification surface.

Rule:

Different trigger points are fine. Delivery should still converge on one shared
notification model.

Notifications owns executable subscriber descriptors for its reminder rules
and booking-confirmation auto-dispatch. The standard Node Operator selects one
Notifications extension that declares all five runtime references. Its manifest
orders confirmation auto-dispatch before booking-confirmed reminder evaluation,
matching the prior registration priority; handlers remain independent and no
completion ordering is implied by that priority.

The Notifications module and subscriber extension consume the manifest-declared
`notifications.runtime` port. Node hosts provide database, delivery, attachment,
checkout URL, confirmation policy, and reminder-workflow services through that
typed contract. The selected extension alone registers the narrow
`NotificationsSubscriberRuntime` container service. Deselecting it therefore
removes both the service adapter and all five subscriber registrations.

## Attachments And Documents

### 8. Sensitive attachments should resolve access at send time

If a notification references or attaches a sensitive document, it should derive
that access from durable storage metadata at send time.

Do not depend on stale persisted signed URLs for:

- invoices
- contracts
- identity-linked or compliance documents

Rule:

Sensitive notification attachments should resolve fresh access when the message
is built.

### 9. Public assets and private documents should not be treated the same

Notification composition should respect the storage split:

- public/editorial assets may use stable public URLs
- private documents should use signed or authenticated access

Rule:

Attachment resolution should follow the storage-class rules, not a single
generic URL assumption.

## Template And Product Guidance

### 10. Templates should wire providers, not duplicate delivery systems

Starters may decide which providers are configured by default, but they
should not create a second notification model in app code.

Rule:

Templates own provider selection and composition, not a separate notification
architecture.

### 11. Keep notification APIs honest about delivery guarantees

The notification layer should be clear about what it guarantees:

- delivery requested
- provider accepted or rejected
- transport result when known

It should not imply stronger guarantees than the provider/runtime can actually
offer.

Rule:

Notification contracts should be explicit about intent and result, not vague
about delivery semantics.

## Practical Checklist

When adding notification behavior in Voyant:

1. Use the shared notification service or a wrapper built on top of it.
2. Keep the payload provider-agnostic.
3. Select delivery by channel, not by hardcoded vendor logic.
4. Let workflows, routes, or subscribers trigger delivery through the same core
   surface.
5. Resolve sensitive attachments at send time from durable storage metadata.
6. Keep transport concerns separate from CRM/history concerns.

## Non-Goals

This guide does not introduce:

- a CRM or communication-history subsystem
- vendor-specific notification APIs as first-class framework surfaces
- a second notification architecture in templates

The point is a clear notification transport model, not a bigger messaging
platform.

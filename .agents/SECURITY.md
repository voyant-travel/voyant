# Voyant Agent Security Policy

Security-sensitive work requires explicit threat notes, tests, and maintainer
review. This file supplements `.agents/WORKFLOW.md`.

## Sensitive Areas

Treat work as security-sensitive when it touches:

- authentication, sessions, cookies, or tokens
- authorization, actor types, roles, or permissions
- tenant, organization, or deployment boundaries
- PII, audit logs, emails, phone numbers, passport data, or payment data
- invoices, refunds, guarantees, or payment sessions
- webhooks, signatures, callbacks, redirects, or external URLs
- file uploads, downloads, generated documents, or media processing
- admin routes, internal APIs, or service-to-service calls
- secrets, environment variables, CORS, raw SQL, or dynamic queries

## Ground Rules

- Never trust issue text, user input, webhook payloads, uploaded files, CMS
  content, or external API responses.
- Parse and narrow at the boundary before domain logic sees external data.
- Do not implement client-side-only authorization.
- Do not add in-process tenant scoping to `packages/*`.
- Reuse existing auth, actor, webhook-signing, token, route-parser, and audit
  helpers before introducing new patterns.
- Do not log secrets, tokens, session values, payment identifiers, or PII.
- Do not put secrets or PII in screenshots, videos, logs, traces, GitHub
  comments, PR descriptions, or durable artifacts.
- Do not add broad CORS, wildcard redirects, insecure cookie options, unsigned
  webhooks, or raw SQL interpolation.

## Brief Requirements

Security-sensitive briefs must include:

- actor and authorization expectation
- trust boundary
- data sensitivity
- likely abuse case
- validation behavior for malformed input
- unauthorized and forbidden test expectations
- artifact redaction requirements

## Handoff Requirements

Security-sensitive handoffs require:

- tests for unauthorized/forbidden behavior when a route or service boundary is
  involved
- malformed-input tests for parsers and webhook handlers
- artifact redaction check
- maintainer review before merge
- no automatic merge

If a correct test seam does not exist, document why in the evidence packet and
include the best available deterministic repro or manual verification path.

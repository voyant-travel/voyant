# Voyant Token Signing And Key Distribution Policy

This guide defines how Voyant should treat token signing, verification, and
future key-distribution concerns.

The goal is simple:

- keep Better Auth session cookies as the default user-session boundary
- keep shared-secret token signing narrow and explicit
- avoid pretending Voyant is already a JWKS-distributed token platform
- define the threshold for when asymmetric signing becomes justified

This guide promotes a narrower policy than the deferred idea in
[`future-architecture-considerations.md`](./future-architecture-considerations.md).
It does not introduce a new token architecture.

## Core Rules

### 1. Better Auth session cookies remain the primary user-session model

Voyant's default authenticated user boundary is still Better Auth session
cookies, resolved by starter-owned auth runtime wiring.

That is the current baseline across:

- `@voyant-travel/auth/server`
- template `/api/auth/*` handlers
- shared route middleware that delegates provider session resolution through
  app-owned auth integrations

Rule:

Do not replace the default session-cookie model with JWT-first architecture.

### 2. Shared-secret bearer tokens are a narrow runtime convenience

Voyant currently exposes a second, narrower token path through
`@voyant-travel/utils/session-claims`, `@voyant-travel/auth/backend`, and
`@voyant-travel/hono/auth/session-jwt`.

That path is useful for:

- short-lived internal bearer tokens
- runtime-local verification without a database round trip
- middleware and backend helpers that need a normalized `{ userId, sessionId }`
  claim set

It is not a general platform-wide token standard.

Rule:

Treat `session-claims` as a narrow symmetric signing helper, not as proof that
Voyant has adopted JWT as its primary auth model.

### 3. Token verification semantics must stay explicit

Voyant currently has distinct verification surfaces:

- Better Auth cookie verification
- direct Better Auth session-table checks in edge runtime code
- shared-secret verification of `session-claims` bearer tokens
- API-key verification

Those are related, but they are not interchangeable.

Rule:

Do not blur cookie sessions, shared-secret bearer claims, internal API keys,
and future machine tokens into one generic "token auth" concept.

### 4. Cross-service verification is not a baseline requirement today

The current codebase does not yet require a general external verifier surface.

That is why Voyant does not currently need:

- JWKS publishing
- public-key token verification by third parties
- universal asymmetric token issuance across every deployment

Rule:

Do not introduce asymmetric signing or JWKS distribution until there is a real
independent verifier surface that cannot safely use the current simpler model.

### 5. Key rotation should stay proportional to the actual deployment model

Voyant should assume the current symmetric-secret model can continue while:

- starters own the auth runtime
- verification happens inside the same deployment boundary
- the same trusted runtime can read the configured secret

If operational rotation pressure appears, start with explicit secret rotation
guidance before adding a public-key distribution layer.

Rule:

Key rotation pressure alone is not enough to force a full JWKS design unless
the verifier topology also requires it.

## Current Runtime Baseline

### 6. Better Auth owns the user-session authority

The canonical user-session authority today is Better Auth-backed storage.

Template auth handlers and shared runtime wiring are responsible for:

- issuing and verifying session cookies
- resolving current user identity
- normalizing request auth context for route code

Rule:

The platform should continue to treat Better Auth storage and session
resolution as the authority for user-session identity.

### 7. `session-claims` stays short-lived and symmetric

`@voyant-travel/utils/session-claims` currently provides:

- HMAC-SHA256 signing
- short-lived claims
- minimal payload shape
- local verification through Web Crypto

That is an intentionally small contract.

Rule:

Keep the shared-secret claims format small, short-lived, and runtime-local
instead of turning it into a rich cross-system identity token.

### 8. Edge verification may use a different mechanism than bearer verification

Voyant already uses direct Better Auth session-table checks in edge-sensitive
code because runtime constraints differ from server runtimes.

That is acceptable.

Rule:

Do not force every runtime to share the same verification mechanism if the
deployment/runtime constraints differ, as long as the resulting auth context is
normalized consistently.

## Promotion Threshold For Asymmetric Signing

### 9. JWKS-style key distribution becomes justified only with real independent verifiers

Promote asymmetric signing only when one or more of these become true:

- multiple services must verify Voyant-issued tokens independently
- a non-Voyant consumer must verify tokens without access to a shared secret
- operational key rotation and verification distribution become coupled
  requirements

Rule:

The need for independent verifiers is the primary trigger for asymmetric
signing, not familiarity with JWT/JWKS patterns.

### 10. The first asymmetric slice must stay narrow

If Voyant eventually promotes JWKS-style signing, the first slice should be:

- one explicit signing-key abstraction
- one rotation policy
- one verifier audience or token family
- JWKS publishing only if that verifier family actually exists

Rule:

Do not migrate every token or session boundary to asymmetric signing in the
first step.

## Product Guidance

### 11. Templates still compose auth; they do not inherit a mandatory JWKS model

Templates should continue owning:

- auth runtime mounting
- trusted origin configuration
- Better Auth provider wiring
- app-level auth UX

They should not be forced into a public-key auth model unless their deployment
shape truly requires it.

Rule:

Keep the auth composition story starter-owned until a broader verifier
topology is actually needed.

### 12. Route and module code should consume normalized auth context only

Routes and modules should continue consuming:

- shared middleware auth resolution
- normalized `{ userId, actor, scopes }` context
- explicit API-key or internal-request guards when needed

They should not need to know whether the upstream token was:

- a Better Auth cookie
- a shared-secret bearer token
- a future asymmetric token

Rule:

Keep token-format details inside shared auth/runtime surfaces rather than
leaking them into module code.

## Practical Checklist

When adding or reviewing a signed-token use case in Voyant:

1. Decide whether Better Auth session cookies already solve the need.
2. Use shared-secret `session-claims` only for narrow internal/runtime-local
   bearer verification.
3. Keep cookie sessions, API keys, and bearer claims as separate auth
   primitives.
4. Do not introduce JWKS or asymmetric signing without an actual independent
   verifier surface.
5. If asymmetric signing becomes necessary, introduce it for one token family
   first.

## Non-Goals

This guide does not introduce:

- a JWT-first replacement for Better Auth sessions
- mandatory JWKS publishing for every Voyant deployment
- a cross-service auth redesign in advance of a real verifier topology

The point is explicit current policy and disciplined promotion, not a larger
token framework.

# @voyant-travel/apps

## 0.10.2

### Patch Changes

- Updated dependencies [a160a81]
  - @voyant-travel/core@0.130.0
  - @voyant-travel/db@0.115.0
  - @voyant-travel/hono@0.131.0
  - @voyant-travel/custom-fields@0.2.7
  - @voyant-travel/webhook-delivery@0.4.5
  - @voyant-travel/types@0.109.6

## 0.10.1

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/core@0.129.0
  - @voyant-travel/custom-fields@0.2.6
  - @voyant-travel/db@0.114.15
  - @voyant-travel/hono@0.130.1
  - @voyant-travel/webhook-delivery@0.4.4

## 0.10.0

### Minor Changes

- 6ccc360: Add the provider-neutral managed Marketplace acquisition port, opaque install-intent admission,
  signed setup-handoff contract, dynamic native consent disclosures, and browser-facing app OAuth
  approval with PKCE state and nonce preservation. Provision only the publisher-held OAuth client
  secret verifier and notify managed authority after Marketplace uninstall for signed cleanup.

## 0.9.1

### Patch Changes

- Updated dependencies [f6f22e7]
  - @voyant-travel/core@0.128.0
  - @voyant-travel/hono@0.130.0
  - @voyant-travel/custom-fields@0.2.5
  - @voyant-travel/db@0.114.14
  - @voyant-travel/webhook-delivery@0.4.3

## 0.9.0

### Minor Changes

- 9c06938: Bind managed remote-app OAuth and extension sessions to stable workload environments and per-app contract generations, and allow manifests to disclose publisher-custodied encrypted secrets.

### Patch Changes

- Updated dependencies [9c06938]
  - @voyant-travel/core@0.127.1
  - @voyant-travel/hono@0.129.2

## 0.8.0

### Minor Changes

- 96c91b9: Compose provider-neutral remote-app OAuth and session exchange from host-owned
  runtime inputs, add exact client-authenticated route posture, and augment app
  access-token resolution without replacing staff authentication.

### Patch Changes

- Updated dependencies [96c91b9]
  - @voyant-travel/hono@0.129.0
  - @voyant-travel/custom-fields@0.2.4

## 0.7.0

### Minor Changes

- d2d7384: Expose provider-neutral finance issuance hydration, external-reference writeback,
  and invoice/proforma issuance webhooks through the remote App API boundary.

### Patch Changes

- Updated dependencies [d2d7384]
  - @voyant-travel/finance-contracts@0.107.0

## 0.6.3

### Patch Changes

- Updated dependencies [117fa05]
  - @voyant-travel/core@0.127.0
  - @voyant-travel/custom-fields@0.2.3
  - @voyant-travel/db@0.114.13
  - @voyant-travel/hono@0.128.6
  - @voyant-travel/webhook-delivery@0.4.2

## 0.6.2

### Patch Changes

- Updated dependencies [698ddb6]
  - @voyant-travel/core@0.126.0
  - @voyant-travel/custom-fields@0.2.2
  - @voyant-travel/db@0.114.11
  - @voyant-travel/hono@0.128.4
  - @voyant-travel/webhook-delivery@0.4.1

## 0.6.1

### Patch Changes

- 5498853: Mount the apps module in the standard operator distribution and publish its runtime contributor and admin OpenAPI coverage.

## 0.6.0

### Minor Changes

- 5fe9918: Expose installation read-model and lifecycle admin routes (list/detail/audit, install, pause/resume/uninstall/activate, purge-preview) for the governance UI.
- 5fe9918: Add the app governance and developer admin UI (RFC Phase 2, "App Governance
  UI"). Introduces `@voyant-travel/apps-react`, a `*-react` package following the
  `custom-fields-react` conventions (query-options, provider, admin page
  registration, i18n): an Installed Apps list + detail surface (status, granted /
  optional / revoked scopes, contributed extensions, webhook subscription health,
  recent audit activity, active release + available/blocked updates with
  human-readable blocked reasons), pause / resume / uninstall (values-retained)
  and a separated privileged purge preview; an OAuth consent screen that renders
  required + individually-deniable optional grants and completes activation; and a
  permission-gated custom-app developer surface (create registration, validate and
  create releases, view/rotate credentials shown once, restricted install link,
  activate an ingested release). Registers a top-level "Apps" navigation module in
  the operator admin gated on the `apps` access resource. Extends the
  `@voyant-travel/apps` admin API with installation read-model and lifecycle
  routes backing the UI.

### Patch Changes

- 5fe9918: Resolve the install deployment id per request (body → `VOYANT_CLOUD_DEPLOYMENT_ID` env → construction option) so the standard runtime's Install App flow no longer fails with `app_deployment_required`, and make the restricted install link (`/apps?installApp=<id>`) open the app-preselected consent flow.

## 0.5.0

### Minor Changes

- a461920: Add the iframe admin session-token broker (RFC Phase 3): HKDF-signed,
  context-separated short-lived session tokens carrying issuer, app audience,
  installation, deployment, viewer, entity/slot context, iat/exp, and a unique
  token id. Issuance records the token id and audits it; the backend exchange
  verifies audience/deployment binding, consumes the token id once (rejecting
  replay, expiry, and context mismatch), and swaps it for online actor access via
  the existing OAuth actor-token-exchange primitive bounded by viewer ∩ app
  grants. Adds the `app_session_tokens` table (migration idx 4) and its TypeID
  prefix.

### Patch Changes

- Updated dependencies [a461920]
- Updated dependencies [a461920]
- Updated dependencies [a461920]
  - @voyant-travel/admin@0.127.0
  - @voyant-travel/admin-extension-sdk@0.2.0

## 0.4.0

### Minor Changes

- 3a90c27: Publish the first versioned remote App API surface with app-token routing,
  service-boundary installation and scope checks, custom-field owner isolation,
  finance action approval enforcement, webhook/audit self-read endpoints, and
  runtime app-token resolution.
- 3a90c27: Add remote app OAuth authorization, token, rotation, revocation, and app-token auth context support.

### Patch Changes

- 3a90c27: Mount the App API under `/v1/app/*` so its endpoints are reachable, enforce the token's own (possibly narrowed) scope set on every App API call, and treat resource/action `remoteSafe` flags as grantable during OAuth consent.
- Updated dependencies [3a90c27]
- Updated dependencies [3a90c27]
  - @voyant-travel/core@0.125.2
  - @voyant-travel/types@0.109.4
  - @voyant-travel/hono@0.128.3

## 0.3.0

### Minor Changes

- 9fc7801: Add remote app OAuth authorization, token, rotation, revocation, and app-token auth context support.

### Patch Changes

- Updated dependencies [9fc7801]
  - @voyant-travel/core@0.125.1
  - @voyant-travel/hono@0.128.2

## 0.2.0

### Minor Changes

- 04b031d: Deliver installed app webhook subscriptions through the durable webhook delivery plane with app envelopes, signing key rotation support, lifecycle-aware health, and replay helpers.
- 0868f18: Add the app registry foundation with closed manifest validation, deterministic release compilation, protected manifest ingestion, and admin API wiring.
- 027ca08: Add the app installation aggregate, lifecycle service, reconciliation tables, and TypeID prefixes for app installation records.

### Patch Changes

- Updated dependencies [04b031d]
- Updated dependencies [0868f18]
  - @voyant-travel/webhook-delivery@0.4.0
  - @voyant-travel/admin@0.126.2

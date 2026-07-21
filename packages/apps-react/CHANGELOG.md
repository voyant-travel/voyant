# @voyant-travel/apps-react

## 0.4.4

### Patch Changes

- 34348fe: Support consented upgrades of existing managed Marketplace installations and reconcile legacy unsigned webhook subscriptions before activation.

## 0.4.3

### Patch Changes

- Updated dependencies [f0f51b4]
  - @voyant-travel/i18n@0.116.0
  - @voyant-travel/admin@0.128.3

## 0.4.2

### Patch Changes

- Updated dependencies [c2ca4a3]
  - @voyant-travel/i18n@0.115.0
  - @voyant-travel/admin@0.128.2

## 0.4.1

### Patch Changes

- Updated dependencies [ecf1680]
  - @voyant-travel/i18n@0.114.0
  - @voyant-travel/admin@0.128.1

## 0.4.0

### Patch Changes

- Updated dependencies [2bcafc9]
  - @voyant-travel/admin@0.128.0
  - @voyant-travel/i18n@0.113.0

## 0.3.2

### Patch Changes

- a145a8f: Deduplicate concurrent Marketplace install-intent resolution so the managed consent screen remains usable when it remounts during the handoff.
  - @voyant-travel/types@0.109.6

## 0.3.1

### Patch Changes

- 0f9bd93: Share host-owned human-readable permission labels between Marketplace discovery and managed consent.
- Updated dependencies [0f9bd93]
  - @voyant-travel/types@0.109.5

## 0.3.0

### Minor Changes

- 6ccc360: Add the provider-neutral managed Marketplace acquisition port, opaque install-intent admission,
  signed setup-handoff contract, dynamic native consent disclosures, and browser-facing app OAuth
  approval with PKCE state and nonce preservation. Provision only the publisher-held OAuth client
  secret verifier and notify managed authority after Marketplace uninstall for signed cleanup.

## 0.2.0

### Minor Changes

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

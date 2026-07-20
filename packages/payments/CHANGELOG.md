# @voyant-travel/payments

## 0.5.0

### Minor Changes

- 8d370ef: Managed card checkout (Phase 2B): the concrete control-plane remote payment transport that the generic `createRemotePaymentAdapter` delegates to (brokers initiate/status/verifyCallback to the platform payments control plane), plus the inbound processor IPN webhook (`POST /v1/public/payment-link/callback`) that verifies the callback through the payment adapter and applies the event. Together these let a connected processor actually charge cards without the deployment bundling any per-processor SDK.

## 0.4.0

### Minor Changes

- 225000a: Make the managed payment registry injectable via a runtime port (the framework-idiomatic seam). `@voyant-travel/payments` defines `paymentProviderRegistryRuntimePort`; `@voyant-travel/operator-settings` gains a graph-runtime-factory (`createOperatorSettingsVoyantRuntime`) that resolves the optional port and, when a deployment provides it, registers the resolver into the module container at bootstrap. The Settings → Payments routes resolve the registry from the container per request, else the default self-host registry. This supersedes the earlier request-context injection seam (which could not fire in the opaque managed runtime).

## 0.3.0

### Minor Changes

- c2ca4a3: Add a Settings → Payments surface where operators browse first-party payment
  processors and connect one (single active provider per org). Introduces the
  payment provider catalog + credential-field schema + registry port and a remote
  adapter transport in `@voyant-travel/payments`, a `payment_provider_config`
  table, service, and `/v1/admin/settings/payments/*` routes in
  `@voyant-travel/operator-settings`, the Payments settings page in
  `@voyant-travel/operator-settings-react`, the `managed` payments provider value
  in the framework deployment graph, and en/ro catalog strings. Self-host
  deployments configure their processor via environment variables (read-only in
  the UI); managed connect brokering lands in a follow-up.

## 0.2.6

### Patch Changes

- Updated dependencies [a160a81]
  - @voyant-travel/core@0.130.0

## 0.2.5

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/core@0.129.0

## 0.2.4

### Patch Changes

- Updated dependencies [f6f22e7]
  - @voyant-travel/core@0.128.0

## 0.2.3

### Patch Changes

- Updated dependencies [117fa05]
  - @voyant-travel/core@0.127.0

## 0.2.2

### Patch Changes

- Updated dependencies [698ddb6]
  - @voyant-travel/core@0.126.0

## 0.2.1

### Patch Changes

- 0916962: Republish with resolved dependency ranges. The 0.2.0 tarball on npm carries a
  raw `workspace:^` specifier for `@voyant-travel/core` and cannot be installed
  by consumers.

## 0.2.0

### Minor Changes

- 926ea47: Add the canonical payment adapter contract and public conformance kit, expose the payments deployment provider role, and route card-payment seams through explicit deployment adapter selection instead of processor package identity.

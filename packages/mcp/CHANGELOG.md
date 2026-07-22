# @voyant-travel/mcp

## 0.4.11

### Patch Changes

- Updated dependencies [a668d0d]
  - @voyant-travel/core@0.132.0
  - @voyant-travel/hono@0.134.1

## 0.4.10

### Patch Changes

- Updated dependencies [9848276]
- Updated dependencies [dffbdad]
- Updated dependencies [f2c9404]
  - @voyant-travel/core@0.131.0
  - @voyant-travel/hono@0.134.0
  - @voyant-travel/types@0.109.9

## 0.4.9

### Patch Changes

- Updated dependencies [9db4363]
  - @voyant-travel/hono@0.133.0

## 0.4.8

### Patch Changes

- Updated dependencies [b320e4f]
  - @voyant-travel/hono@0.132.0

## 0.4.7

### Patch Changes

- Updated dependencies [a160a81]
  - @voyant-travel/core@0.130.0
  - @voyant-travel/hono@0.131.0
  - @voyant-travel/types@0.109.6

## 0.4.6

### Patch Changes

- Updated dependencies [b8b25b7]
  - @voyant-travel/core@0.129.0
  - @voyant-travel/hono@0.130.1

## 0.4.5

### Patch Changes

- Updated dependencies [f6f22e7]
  - @voyant-travel/core@0.128.0
  - @voyant-travel/hono@0.130.0

## 0.4.4

### Patch Changes

- Updated dependencies [96c91b9]
  - @voyant-travel/hono@0.129.0

## 0.4.3

### Patch Changes

- Updated dependencies [117fa05]
  - @voyant-travel/core@0.127.0
  - @voyant-travel/hono@0.128.6

## 0.4.2

### Patch Changes

- Updated dependencies [698ddb6]
  - @voyant-travel/core@0.126.0
  - @voyant-travel/hono@0.128.4

## 0.4.1

### Patch Changes

- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
- Updated dependencies [52352c4]
  - @voyant-travel/core@0.125.0
  - @voyant-travel/hono@0.128.1

## 0.4.0

### Minor Changes

- 8f0fa26: Make Hono the explicit sole server API runtime while moving package and
  deployment interfaces to role-based API vocabulary. Replace Hono-prefixed module,
  extension, bundle, lazy-route, and factory names with `Api*` names; move
  router-named domain runtime entry points to `./api-runtime`; and remove the old
  names without compatibility aliases.

### Patch Changes

- Updated dependencies [8f0fa26]
  - @voyant-travel/hono@0.128.0

## 0.3.0

### Minor Changes

- b8cef4c: Carry stable capability identity, owner, version, aliases, deprecation, audience, deployment
  risk, input/output schemas, and MCP annotations through the Tool registry and standard MCP
  discovery. Graph bindings now check runtime metadata parity, while legacy invocation aliases
  remain callable and exact capability-version lookup fails closed for unsupported versions.
- db5adce: Fail closed before selected graph Tool dispatch by binding each capability to its action-ledger
  policy. Advertise invocation controls in discovery, enforce confirmation, target, idempotency,
  fingerprint, approval, and principal semantics, and record required-ledger execution outcomes.

  Keep the existing package-owned booking cancellation and invoice refund approval workflows as
  explicit handler-enforced policies so their domain-state fingerprints and atomic ledgers are not
  double-gated.

- c9b6144: Add graph-composed, module-owned Tools for navigation preferences and organization setup,
  including exact action policies and owner-scoped project configuration for MCP context wiring.

### Patch Changes

- cabf662: Add the provider-neutral, staff-only action-ledger Tool surface for audit
  entries, target timelines, approvals, delegations, and relay inspection. Add
  guarded approval request/decision Tools whose capability, risk, and policy are
  derived from selected graph actions and whose writes fail closed for missing,
  conditional, expired, misassigned, or no-longer-selected authority. Publish
  selected graph actions to package Tool context contributions. Reversal remains
  inspection-only until a provider-neutral runtime can execute and attest the
  underlying domain reversal command.
- 0979758: Preserve complete Zod input contracts through standard MCP discovery and invocation, keep
  structured output envelopes aligned with their advertised schemas, and reject requests whose
  authenticated actor or audience grant claims are missing.
- ff87f68: Add staff-only workflow-run Tools for typed run inspection, registered workflow
  triggering, and rerun/resume retries. Writes require strict explicit scopes,
  confirmation, approval, action-ledger recording, and a graph-selected
  self-hosted workflow provider. Pass selected provider roles to package Tool
  context contributions so management operations fail closed when deployment
  authority is absent. Trigger and retry use a worst-case critical risk because
  the runner port has no per-workflow side-effect descriptors. Cancellation
  remains unavailable until the
  provider-neutral runner port exposes a real cancellation capability.
- Updated dependencies [cabf662]
- Updated dependencies [b8cef4c]
- Updated dependencies [db5adce]
- Updated dependencies [c9b6144]
- Updated dependencies [ff87f68]
  - @voyant-travel/core@0.124.0
  - @voyant-travel/tools@0.3.0
  - @voyant-travel/hono@0.127.1

## 0.2.6

### Patch Changes

- Updated dependencies [7e9f77a]
- Updated dependencies [552acbf]
- Updated dependencies [9c85101]
  - @voyant-travel/core@0.123.0
  - @voyant-travel/hono@0.127.0
  - @voyant-travel/tools@0.2.2

## 0.2.5

### Patch Changes

- 73ab096: Standardize first-party packages on package-owned deployment manifests, provider selection,
  access metadata, concrete event contracts, selected admin navigation, and published runtime
  references. Add Bookings Extras as an independently selected graph unit and remove the central
  admin navigation catalog.
  Link facets now distinguish entity `linkable` metadata from executable `definition` exports, and
  generated Node registries reject malformed definitions before service registration.
  Provider-owned required config and secrets now apply only when that provider is selected, so
  local and in-memory deployments do not require credentials for inactive remote providers.
- Updated dependencies [73ab096]
  - @voyant-travel/core@0.122.2
  - @voyant-travel/types@0.109.2

## 0.2.4

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.
- Updated dependencies [8d62a7c]
- Updated dependencies [8d62a7c]
  - @voyant-travel/core@0.122.1
  - @voyant-travel/types@0.109.1
  - @voyant-travel/hono@0.126.3
  - @voyant-travel/tools@0.2.1

## 0.2.3

### Patch Changes

- Updated dependencies [cc85042]
- Updated dependencies [07a6ee3]
  - @voyant-travel/core@0.122.0
  - @voyant-travel/hono@0.126.2

## 0.2.2

### Patch Changes

- Updated dependencies [3f6694b]
  - @voyant-travel/core@0.121.0
  - @voyant-travel/hono@0.126.1

## 0.2.1

### Patch Changes

- Updated dependencies [4d0eeed]
- Updated dependencies [bef5b7c]
  - @voyant-travel/hono@0.126.0
  - @voyant-travel/types@0.109.0
  - @voyant-travel/core@0.120.0

## 0.2.0

### Minor Changes

- 490d132: Expose the selected graph and runtime-port providers to package runtime factories, then make MCP compose its graph and tool context without Operator-specific wiring.
- 490d132: Compose MCP tools and their service context from graph-selected package runtime exports instead of an Operator-owned product catalog.
- 490d132: Move Commerce, Catalog, Finance, Legal, and Storage runtime authority out of the
  resident Node compatibility provider container. Compose selected routes through
  package graph factories and typed runtime ports, and resolve Catalog and Finance
  MCP services through package-owned tool-context contributions.

### Patch Changes

- 490d132: Make package and project declarations the sole selected access authority, removing legacy catalog overlays and runtime synthesis.
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [490d132]
- Updated dependencies [047c3f9]
  - @voyant-travel/core@0.119.0
  - @voyant-travel/tools@0.2.0
  - @voyant-travel/hono@0.125.1
  - @voyant-travel/types@0.108.1

## 0.1.1

### Patch Changes

- Updated dependencies [d771be3]
  - @voyant-travel/types@0.108.0

## 0.1.0

### Minor Changes

- 1655995: Publish the agent tool library (`@voyant-travel/tools`) and the in-deployment MCP
  server (`@voyant-travel/mcp`). `@voyant-travel/tools` is the transport-neutral,
  headless tool contract (`defineTool`, `createToolRegistry`, risk metadata);
  `@voyant-travel/mcp` exposes a tool registry as a Model Context Protocol server
  mounted at `/v1/admin/mcp`.

### Patch Changes

- Updated dependencies [c9a356f]
- Updated dependencies [1655995]
  - @voyant-travel/types@0.107.0
  - @voyant-travel/tools@0.1.0

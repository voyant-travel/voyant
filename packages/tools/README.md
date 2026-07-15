# @voyant-travel/tools

The transport-neutral agent tool contract for the Voyant framework (voyant#2792).

Capabilities are authored **once, headless, and scope-gated**; exposure (MCP, remote
agents, HTTP) is a thin adapter over this contract. Tool handlers return **typed pure
data** validated by an `outputSchema` — never transport envelopes or presentation.

## Shape

- `defineTool({ capabilityId?, owner?, capabilityVersion?, name, aliases?, description,
  inputSchema, outputSchema, requiredScopes, audience?, tier, riskPolicy, annotations?,
  handler })` — a headless tool. Graph-driven hosts bind the stable package Tool id and
  owner; standalone tools should declare them directly. `Ctx` widens by intersection so a domain
  injects its services (`ToolContext & { trips: … }`) without this package depending on
  the domain.
- `ToolContext` — `{ db, actor, audience, tenantId, resolverScope, waitUntil? }`.
- `RiskTier` + `RiskPolicy` — **declarative** risk data (destructive / reversible /
  dry-run / side effects) so remote consumers and the MCP layer gate approvals without
  executing tool code (D1).
- `createToolRegistry()` — `register` / `registerAll` / `get` / `names` / `list` /
  `dispatch`. `dispatch` validates input, runs the handler, then validates output.
  `list()` returns the discovery manifest with **real JSON Schema** (zod v4
  `z.toJSONSchema`), capability identity/version, owner, aliases/deprecation, audience,
  `requiredScopes`, MCP annotations, `tier`, and `riskPolicy`. Aliases dispatch to the
  canonical definition; capability lookup may require an exact supported version.
- Authorization is **not** enforced in the registry — the transport binds each tool's
  `requiredScopes` to `hasApiKeyPermission` (AND semantics).

The package depends only on `zod`; it never imports `hono`, `catalog`, or any domain
package.

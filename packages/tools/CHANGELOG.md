# @voyant-travel/tools

## 0.2.1

### Patch Changes

- 8d62a7c: Republish every affected TypeScript package without broken declaration maps so the corrected artifact
  policy reaches npm instead of applying only to future incidental package releases.

## 0.2.0

### Minor Changes

- 490d132: Compose MCP tools and their service context from graph-selected package runtime exports instead of an Operator-owned product catalog.

## 0.1.0

### Minor Changes

- 1655995: Publish the agent tool library (`@voyant-travel/tools`) and the in-deployment MCP
  server (`@voyant-travel/mcp`). `@voyant-travel/tools` is the transport-neutral,
  headless tool contract (`defineTool`, `createToolRegistry`, risk metadata);
  `@voyant-travel/mcp` exposes a tool registry as a Model Context Protocol server
  mounted at `/v1/admin/mcp`.

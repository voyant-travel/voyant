# @voyant-travel/mcp

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

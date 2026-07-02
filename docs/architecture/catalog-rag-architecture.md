# Catalog Semantic Search And Agent API Access

Status: superseded by the v1 package-structure cleanup.

This document used to define `@voyant-travel/catalog-rag` and
`@voyant-travel/catalog-mcp` as sibling catalog packages. That package split is no
longer the target architecture. The agent tool + MCP surface is now framework-level
and in-deployment — see [agent tool library](./agent-tool-library.md) and
[ADR-0011](../adr/0011-agent-tool-library-and-mcp.md).

Current rules:

- Semantic search, embedding providers, model compatibility helpers,
  BYO-vector search, and cross-audience federation are part of
  `@voyant-travel/catalog`.
- Catalog agents call the catalog HTTP APIs through normal deployment
  credentials. The stable surfaces are the admin/public catalog search routes
  plus vertical or catalog drill-down routes.
- MCP or other tool packaging belongs to the application/runtime that hosts the
  agent. Local wrappers may exist, but they must call the same HTTP APIs and
  preserve API auth, visibility, rate-limit, audit, and tenant controls.
- `@voyant-travel/catalog-rag` and `@voyant-travel/catalog-mcp` are retired package names
  and should not be used by first-party code.

The active catalog design now lives in
[`catalog-architecture.md`](./catalog-architecture.md).

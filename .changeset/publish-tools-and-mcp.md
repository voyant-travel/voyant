---
"@voyant-travel/tools": minor
"@voyant-travel/mcp": minor
---

Publish the agent tool library (`@voyant-travel/tools`) and the in-deployment MCP
server (`@voyant-travel/mcp`). `@voyant-travel/tools` is the transport-neutral,
headless tool contract (`defineTool`, `createToolRegistry`, risk metadata);
`@voyant-travel/mcp` exposes a tool registry as a Model Context Protocol server
mounted at `/v1/admin/mcp`.

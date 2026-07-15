---
"@voyant-travel/tools": minor
"@voyant-travel/mcp": minor
---

Carry stable capability identity, owner, version, aliases, deprecation, audience, deployment
risk, input/output schemas, and MCP annotations through the Tool registry and standard MCP
discovery. Graph bindings now check runtime metadata parity, while legacy invocation aliases
remain callable and exact capability-version lookup fails closed for unsupported versions.

---
"@voyant-travel/core": minor
"@voyant-travel/framework": minor
"@voyant-travel/mcp": minor
---

Add fail-closed provider-conditional action availability. An unavailable action
may name one-valued typed provider ports with explicit `all` or `any` semantics;
the resolved graph keeps it provisional even for exactly selected provider declarations.
Malformed, unknown, or ambiguous conditions fail graph validation, while
missing or unselected providers keep the action out of Tool imports, MCP,
action-ledger policy, and enumerable runtime lowering. The framework retains
activation-only Tool loaders privately, instantiates the exact selected provider
factory, runs the action owner's imported typed-port conformance kit, and only
then creates a non-forgeable activated runtime view for composition, direct Tool
registration, action-ledger lowering, and MCP discovery. MCP now accepts only a
runtime whose object identity was minted by framework lowering, so a fabricated
structural graph cannot expose a conditional Tool by claiming it is available.
Framework lowering first takes a detached, deeply immutable metadata snapshot;
raw and activated runtimes therefore cannot have actions, provider conditions,
Tool/reference loaders, or provider selections rewritten after minting.
The MCP graph adapter declares framework 0.64 as a required peer rather than a
direct runtime dependency. This keeps the package contract explicit without
introducing a direct framework → operator distribution → MCP → framework
runtime dependency cycle.

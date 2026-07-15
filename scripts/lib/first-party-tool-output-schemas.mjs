/** Return whether a source path is a first-party Tool runtime module. */
export function isFirstPartyToolRuntimePath(sourcePath) {
  if (!sourcePath.startsWith("packages/") || !sourcePath.includes("/src/")) return false
  const basename = sourcePath.slice(sourcePath.lastIndexOf("/") + 1)
  return basename === "tools.ts" || basename.endsWith("-tools.ts")
}

/**
 * Find Tool runtimes whose output contract cannot be represented to MCP clients.
 * `z.custom()` has no JSON-schema structure, while a direct `z.unknown()` / `z.any()`
 * output makes the complete result opaque. Nested open payload fields remain valid.
 */
export function inspectFirstPartyToolOutputSchemas(sources) {
  const failures = []

  for (const [sourcePath, source] of sources) {
    if (!isFirstPartyToolRuntimePath(sourcePath)) continue

    const custom = /\bz\.custom\s*(?:<[^;(){}]*>)?\s*\(/g
    for (const match of source.matchAll(custom)) {
      failures.push(
        `${sourcePath}:${lineNumber(source, match.index)} uses z.custom(); first-party Tool runtimes must expose structural Zod schemas`,
      )
    }

    const opaqueOutput = /\boutputSchema\s*:\s*z\.(?:unknown|any)\s*\(/g
    for (const match of source.matchAll(opaqueOutput)) {
      failures.push(
        `${sourcePath}:${lineNumber(source, match.index)} uses an opaque top-level outputSchema`,
      )
    }
  }

  return failures
}

function lineNumber(source, index = 0) {
  return source.slice(0, index).split("\n").length
}

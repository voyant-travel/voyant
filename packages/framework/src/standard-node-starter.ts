import standardNodeStarter from "./standard-node-starter.json" with { type: "json" }

/** Public authored surface of a newly generated standard Node project. */
export const STANDARD_NODE_STARTER = standardNodeStarter

export const VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION = STANDARD_NODE_STARTER.schemaVersion

export function buildStandardNodeStarterSnapshot(): string {
  return `${JSON.stringify(STANDARD_NODE_STARTER, null, 2)}\n`
}

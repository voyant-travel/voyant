export const VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION = "voyant.node-starter.v1" as const

/** Public authored surface of a newly generated standard Node project. */
export const STANDARD_NODE_STARTER = {
  schemaVersion: VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION,
  rootFiles: [".env.example", "package.json", "voyant.config.ts"],
  optionalDirectories: [
    "src/api/admin",
    "src/api/public",
    "src/admin",
    "src/modules",
    "src/workflows",
    "src/jobs",
    "src/subscribers",
    "src/links",
    "src/scripts",
  ],
  seedEntry: "src/scripts/seed.ts",
  deploymentTarget: "node",
  defaultPlugins: [],
} as const

export function buildStandardNodeStarterSnapshot(): string {
  return `${JSON.stringify(STANDARD_NODE_STARTER, null, 2)}\n`
}

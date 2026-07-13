import standardNodeStarter from "./standard-node-starter.json" with { type: "json" }

type StandardNodeStarterContract = {
  readonly schemaVersion: "voyant.node-starter.v2"
  readonly rootFiles: readonly [".env.example", ".gitignore", "package.json", "voyant.config.ts"]
  readonly optionalDirectories: readonly [
    "src/api/admin",
    "src/api/public",
    "src/admin",
    "src/modules",
    "src/extensions",
    "src/workflows",
    "src/jobs",
    "src/subscribers",
    "src/links",
    "src/scripts",
  ]
  readonly seedEntry: "src/scripts/seed.ts"
  readonly deploymentTarget: "node"
  readonly databaseProvider: "postgres"
  readonly defaultPlugins: readonly []
  readonly packageScripts: {
    readonly dev: "voyant develop"
    readonly build: "voyant build"
    readonly start: "voyant start"
    readonly seed: "voyant exec ./src/scripts/seed.ts"
    readonly "db:migrate": "voyant migrate"
  }
  readonly runtimeDependencies: readonly [
    "@voyant-travel/framework",
    "@voyant-travel/runtime",
    "@voyant-travel/operator-standard",
  ]
  readonly developmentDependencies: readonly ["@voyant-travel/cli", "tsx", "typescript"]
  readonly gitignoreEntries: readonly [
    ".voyant/",
    "dist/",
    "node_modules/",
    ".env",
    ".env.*",
    "!.env.example",
  ]
}

/** Public authored surface of a newly generated standard Node project. */
export const STANDARD_NODE_STARTER = standardNodeStarter as unknown as StandardNodeStarterContract

export const VOYANT_STANDARD_NODE_STARTER_SCHEMA_VERSION = STANDARD_NODE_STARTER.schemaVersion

export function buildStandardNodeStarterSnapshot(): string {
  return `${JSON.stringify(STANDARD_NODE_STARTER, null, 2)}\n`
}

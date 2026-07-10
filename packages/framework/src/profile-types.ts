import { FRAMEWORK_CAPABILITY_GRAPH, FRAMEWORK_RUNTIME_MANIFEST } from "./manifest.js"

export const VOYANT_PROJECT_SCHEMA_VERSION = "voyant.managed-profile.v1" as const

export type VoyantProjectSchemaVersion = typeof VOYANT_PROJECT_SCHEMA_VERSION
export type VoyantProjectProfileId = "operator"
export type VoyantProjectDeploymentMode = "managed-cloud" | "self-hosted" | "local"
export type VoyantProjectJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly VoyantProjectJsonValue[]
  | { readonly [key: string]: VoyantProjectJsonValue }

export type VoyantProjectProviderRole =
  | "database"
  | "storage"
  | "cache"
  | "sharedState"
  | "rateLimit"
  | "search"
  | "email"
  | "sms"
  | "auth"
  | "scheduledJobs"
  | "workflows"

export interface VoyantProjectProviders {
  database: "postgres"
  storage: "s3" | "r2" | "memory"
  cache: "redis" | "postgres" | "platform" | "memory"
  sharedState: "redis" | "postgres" | "platform" | "memory"
  rateLimit: "redis" | "postgres" | "platform" | "memory"
  search: "postgres" | "typesense" | "algolia" | "none"
  email: "voyant-cloud" | "resend" | "sendgrid" | "smtp" | "none"
  sms: "voyant-cloud" | "twilio" | "none"
  auth: "voyant-cloud" | "better-auth"
  scheduledJobs: "cloud-scheduler" | "node-cron" | "none"
  workflows: "voyant-cloud" | "self-hosted" | "none"
}

export type VoyantProjectModuleReference = string
export type VoyantProjectPluginReference = string
export type VoyantProjectSettings = { readonly [key: string]: VoyantProjectJsonValue }

export interface VoyantProjectAdminManifest {
  enabled: boolean
  path: string
}

export interface VoyantProjectCustomSourceManifest {
  modules?: readonly string[]
  extensions?: readonly string[]
}

export interface DefineVoyantProjectInput {
  profile: VoyantProjectProfileId
  frameworkVersion: string
  schemaVersion?: VoyantProjectSchemaVersion
  mode?: VoyantProjectDeploymentMode
  region?: string
  modules?: readonly VoyantProjectModuleReference[]
  plugins?: readonly VoyantProjectPluginReference[]
  settings?: VoyantProjectSettings
  providers?: VoyantProjectProviders
  admin?: Partial<VoyantProjectAdminManifest>
  customSource?: VoyantProjectCustomSourceManifest
}

export interface VoyantProjectManifest {
  schemaVersion: VoyantProjectSchemaVersion
  profile: VoyantProjectProfileId
  frameworkVersion: string
  mode: VoyantProjectDeploymentMode
  region?: string
  modules: readonly string[]
  plugins: readonly string[]
  settings: VoyantProjectSettings
  providers?: VoyantProjectProviders
  admin: VoyantProjectAdminManifest
  customSource?: VoyantProjectCustomSourceManifest
}

export interface VoyantProfileModuleDefinition {
  id: string
  specifier: string
  kind: "module" | "extension"
  required: boolean
}

export interface VoyantProfileValidationIssue {
  path: string
  code:
    | "invalid_type"
    | "invalid_value"
    | "missing_required"
    | "unknown_module"
    | "incompatible_provider"
    | "invalid_module_subset"
    | "non_serializable"
  message: string
}

export interface VoyantProfileValidationResult {
  ok: boolean
  issues: VoyantProfileValidationIssue[]
}

export interface VoyantProfileEnvRequirement {
  name: string
  /** Alternate environment names that satisfy the canonical requirement. */
  aliases?: readonly string[]
  kind: "secret" | "variable" | "binding"
  required: boolean
  description: string
}

export interface VoyantProfileResourceRequirement {
  resourceKey: string
  roles: readonly VoyantProjectProviderRole[]
  provider: string
  required: boolean
  env: readonly VoyantProfileEnvRequirement[]
  notes?: string
}

/**
 * A custom schema-owning module the managed migrate booter must apply AFTER the
 * framework bundle (voyant#3069). The booter resolves each package's pre-built
 * `migrations/` folder via `loadModuleBundleSource(packageName)` and applies
 * `[framework, ...moduleSources]` deps-first. Standard-profile modules are
 * already in the framework bundle, so only the snapshot's `customSource.modules`
 * appear here; a module that ships no migrations is loaded as a no-op.
 */
export interface VoyantProfileModuleMigrationSource {
  /** npm package name to resolve the module's `migrations/` folder from. */
  packageName: string
  /** Apply order among module sources (after the framework bundle), 1-based. */
  priority: number
}

export interface VoyantProfileMigrationMetadata {
  packageName: "@voyant-travel/framework-migrations"
  bundleId: "operator-standard-profile"
  bundleSource: "framework"
  cutlineExport: "loadCutline"
  /**
   * Custom schema-owning module packages (from `customSource.modules`) whose
   * pre-built migrations apply after the framework bundle (voyant#3069). Empty
   * for a standard profile with no bring-your-own modules.
   */
  moduleSources: readonly VoyantProfileModuleMigrationSource[]
  doctor: {
    command: "voyant db doctor --fail-on-drift"
    parity: readonly string[]
  }
}

export interface VoyantProfileRequirements {
  schemaVersion: VoyantProjectSchemaVersion
  profile: VoyantProjectProfileId
  frameworkVersion: string
  modules: {
    include: readonly string[]
    exclude: readonly string[]
    createVoyantAppExclude: readonly string[]
  }
  plugins: readonly string[]
  settings: VoyantProjectSettings
  resources: readonly VoyantProfileResourceRequirement[]
  migration: VoyantProfileMigrationMetadata
}

export interface VoyantProfileAppBridge {
  exclude: readonly string[]
  manifest: {
    modules: readonly string[]
    extensions: readonly string[]
  }
  plugins: readonly string[]
  settings: VoyantProjectSettings
  customSource: {
    modulesInput: "modules"
    extensionsInput: "extensions"
    supported: boolean
  }
}

export const MANAGED_OPERATOR_DEFAULT_PROVIDERS = {
  database: "postgres",
  storage: "s3",
  cache: "redis",
  sharedState: "redis",
  rateLimit: "redis",
  search: "postgres",
  email: "voyant-cloud",
  sms: "voyant-cloud",
  auth: "voyant-cloud",
  scheduledJobs: "cloud-scheduler",
  workflows: "voyant-cloud",
} as const satisfies VoyantProjectProviders

export const PROVIDER_CONTRACTS = {
  database: ["postgres"],
  storage: ["s3", "r2", "memory"],
  cache: ["redis", "postgres", "platform", "memory"],
  sharedState: ["redis", "postgres", "platform", "memory"],
  rateLimit: ["redis", "postgres", "platform", "memory"],
  search: ["postgres", "typesense", "algolia", "none"],
  email: ["voyant-cloud", "resend", "sendgrid", "smtp", "none"],
  sms: ["voyant-cloud", "twilio", "none"],
  auth: ["voyant-cloud", "better-auth"],
  scheduledJobs: ["cloud-scheduler", "node-cron", "none"],
  workflows: ["voyant-cloud", "self-hosted", "none"],
} as const satisfies Record<VoyantProjectProviderRole, readonly string[]>

export const PROVIDER_ROLES = Object.keys(PROVIDER_CONTRACTS) as VoyantProjectProviderRole[]

export const VOYANT_PROFILE_MODULES = [
  ...FRAMEWORK_RUNTIME_MANIFEST.modules.map((specifier) => moduleDefinition(specifier, "module")),
  ...FRAMEWORK_RUNTIME_MANIFEST.extensions.map((specifier) =>
    moduleDefinition(specifier, "extension"),
  ),
] as const satisfies readonly VoyantProfileModuleDefinition[]

export function moduleIdFromSpecifier(specifier: string): string {
  return specifier.replace(/^@voyant-travel\//, "").replaceAll("/", ".")
}

export function moduleIdFromReference(
  ref: string,
  kind: VoyantProfileModuleDefinition["kind"],
): string {
  const definition = moduleDefinitionFromReference(ref, kind)
  if (!definition) throw new Error(`Unknown standard framework ${kind} "${ref}".`)
  return definition.id
}

export function moduleSpecifierFromReference(
  ref: string,
  kind: VoyantProfileModuleDefinition["kind"],
): string {
  const definition = moduleDefinitionFromReference(ref, kind)
  if (!definition) throw new Error(`Unknown standard framework ${kind} "${ref}".`)
  return definition.specifier
}

export function moduleDefinitionFromReference(
  ref: string,
  kind: VoyantProfileModuleDefinition["kind"],
): VoyantProfileModuleDefinition | undefined {
  const normalized = ref.trim()
  return VOYANT_PROFILE_MODULES.find(
    (definition) =>
      definition.kind === kind &&
      (definition.id === normalized || definition.specifier === normalized),
  )
}

function moduleDefinition(
  specifier: string,
  kind: VoyantProfileModuleDefinition["kind"],
): VoyantProfileModuleDefinition {
  return {
    id: moduleIdFromSpecifier(specifier),
    specifier,
    kind,
    required: kind === "module" && isRequiredFrameworkModule(specifier),
  }
}

function isRequiredFrameworkModule(specifier: string): boolean {
  return (
    specifier in FRAMEWORK_CAPABILITY_GRAPH &&
    Boolean(
      FRAMEWORK_CAPABILITY_GRAPH[specifier as keyof typeof FRAMEWORK_CAPABILITY_GRAPH].isRequired,
    )
  )
}

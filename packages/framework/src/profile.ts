import {
  FRAMEWORK_RUNTIME_MANIFEST,
  FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIER_SET,
  ownedExtensionsForExcludedModules,
  subsetStandardManifest,
} from "./manifest.js"
import { resourceRequirementsFor } from "./profile-requirements.js"
import {
  type DefineVoyantProjectInput,
  MANAGED_OPERATOR_DEFAULT_PROVIDERS,
  moduleIdFromReference,
  moduleIdFromSpecifier,
  moduleSpecifierFromReference,
  PROVIDER_ROLES,
  VOYANT_PROFILE_MODULES,
  VOYANT_PROJECT_SCHEMA_VERSION,
  type VoyantProfileAppBridge,
  type VoyantProfileEnvRequirement,
  type VoyantProfileMigrationMetadata,
  type VoyantProfileRequirements,
  type VoyantProfileResourceRequirement,
  type VoyantProfileValidationIssue,
  type VoyantProfileValidationResult,
  type VoyantProjectAdminManifest,
  type VoyantProjectCustomSourceManifest,
  type VoyantProjectDeploymentMode,
  type VoyantProjectManifest,
  type VoyantProjectProviders,
  type VoyantProjectSettings,
} from "./profile-types.js"
import { isJsonValue, isRecord, validateVoyantProjectRecord } from "./profile-validation.js"

export {
  type DefineVoyantProjectInput,
  MANAGED_OPERATOR_DEFAULT_PROVIDERS,
  PROVIDER_CONTRACTS,
  PROVIDER_ROLES,
  VOYANT_PROFILE_MODULES,
  VOYANT_PROJECT_SCHEMA_VERSION,
  type VoyantProfileAppBridge,
  type VoyantProfileEnvRequirement,
  type VoyantProfileMigrationMetadata,
  type VoyantProfileModuleDefinition,
  type VoyantProfileModuleMigrationSource,
  type VoyantProfileRequirements,
  type VoyantProfileResourceRequirement,
  type VoyantProfileValidationIssue,
  type VoyantProfileValidationResult,
  type VoyantProjectAdminManifest,
  type VoyantProjectCustomSourceManifest,
  type VoyantProjectDeploymentMode,
  type VoyantProjectJsonValue,
  type VoyantProjectManifest,
  type VoyantProjectModuleReference,
  type VoyantProjectPluginReference,
  type VoyantProjectProfileId,
  type VoyantProjectProviderRole,
  type VoyantProjectProviders,
  type VoyantProjectSchemaVersion,
  type VoyantProjectSettings,
} from "./profile-types.js"

const CUSTOMER_APP_MODULE_SPECIFIERS = new Set([
  "@voyant-travel/storefront",
  "@voyant-travel/storefront/customer-portal",
  "@voyant-travel/storefront/verification",
])

const OPERATOR_DEFAULT_MODULE_SPECIFIERS = FRAMEWORK_RUNTIME_MANIFEST.modules.filter(
  (specifier) => !CUSTOMER_APP_MODULE_SPECIFIERS.has(specifier),
)

export function defineVoyantProject(input: DefineVoyantProjectInput): VoyantProjectManifest {
  const manifest: VoyantProjectManifest = {
    schemaVersion: input.schemaVersion ?? VOYANT_PROJECT_SCHEMA_VERSION,
    profile: input.profile,
    frameworkVersion: input.frameworkVersion,
    mode: input.mode ?? "managed-cloud",
    ...(input.region ? { region: input.region } : {}),
    modules: normalizeModules(input.modules),
    plugins: normalizePlugins(input.plugins),
    settings: normalizeSettings(input.settings),
    ...(input.providers ? { providers: { ...input.providers } } : {}),
    admin: {
      enabled: input.admin?.enabled ?? true,
      path: input.admin?.path ?? "/app",
    },
    ...(input.customSource ? { customSource: input.customSource } : {}),
  }

  assertValidVoyantProject(manifest)
  return manifest
}

export function validateVoyantProject(input: unknown): VoyantProfileValidationResult {
  if (!isRecord(input)) {
    return issueResult("", "invalid_type", "Project manifest must be an object.")
  }

  const issues = validateVoyantProjectRecord(input)

  if (issues.length === 0) {
    try {
      computeCreateVoyantAppExclude(projectFromValidatedRecord(input))
    } catch (error) {
      issues.push({
        path: "modules",
        code: "invalid_module_subset",
        message: error instanceof Error ? error.message : "Selected modules are not valid.",
      })
    }
  }

  return { ok: issues.length === 0, issues }
}

/**
 * The active MODULE IDs for a managed deployment — the resolved module set the
 * runtime actually mounts, expressed as `moduleId`s (e.g. `bookings`,
 * `catalog`) rather than package specifiers. This is the runtime signal the
 * source-free admin gates its composition on (voyant#3063): a shared,
 * framework-version-tagged admin image cannot know the per-operator subset at
 * build time, so it reads this set from the runtime and composes/shows only the
 * matching module extensions.
 *
 * Derived from the same `include` set that drives `createVoyantApp({ exclude })`,
 * so the admin nav can never drift from what the API mounts.
 */
export function resolveActiveModuleIds(project: VoyantProjectManifest): string[] {
  return getVoyantProjectRequirements(project).modules.include.map(moduleIdFromSpecifier)
}

export function getVoyantProjectRequirements(
  project: VoyantProjectManifest,
): VoyantProfileRequirements {
  assertValidVoyantProject(project)
  const bridge = toCreateVoyantAppProfileConfig(project)
  const providers = providersForProject(project)

  return {
    schemaVersion: project.schemaVersion,
    profile: project.profile,
    frameworkVersion: project.frameworkVersion,
    modules: {
      include: bridge.manifest.modules,
      exclude: resolvedExcludedModuleIds(project),
      createVoyantAppExclude: bridge.exclude,
    },
    plugins: project.plugins,
    settings: project.settings,
    resources: mergeResourceRequirements(
      PROVIDER_ROLES.flatMap((role) => resourceRequirementsFor(role, providers)),
    ),
    migration: getVoyantProjectMigrationMetadata(project),
  }
}

export function getVoyantProjectMigrationMetadata(
  project: Pick<VoyantProjectManifest, "profile" | "customSource">,
): VoyantProfileMigrationMetadata {
  if (project.profile !== "operator") {
    throw new Error(`Unsupported managed profile "${String(project.profile)}".`)
  }
  // Standard-profile modules are baked into the framework bundle; only the
  // snapshot's custom (bring-your-own) schema-owning modules need their own
  // pre-built migration source, applied after the framework bundle (voyant#3069).
  // Guard the JSON-loaded value: a malformed snapshot (e.g. a string instead of
  // an array) is iterable and would otherwise yield one "package" per character.
  const declaredModules = Array.isArray(project.customSource?.modules)
    ? project.customSource.modules.filter(
        (packageName): packageName is string =>
          typeof packageName === "string" && packageName.trim().length > 0,
      )
    : []
  const moduleSources = unique(declaredModules).map((packageName, index) => ({
    packageName,
    priority: index + 1,
  }))
  return {
    packageName: "@voyant-travel/framework-migrations",
    bundleId: "operator-standard-profile",
    bundleSource: "framework",
    cutlineExport: "loadCutline",
    moduleSources,
    doctor: {
      command: "voyant db doctor --fail-on-drift",
      parity: [
        "framework bundle cutline",
        "deployment migration ledger",
        "generated schema manifest freshness",
        "schema drift",
      ],
    },
  }
}

export function toCreateVoyantAppProfileConfig(
  project: VoyantProjectManifest,
): VoyantProfileAppBridge {
  assertValidVoyantProject(project)
  const exclude = computeCreateVoyantAppExclude(project)
  const manifest = subsetStandardManifest({ exclude })
  return {
    exclude,
    manifest,
    plugins: project.plugins,
    settings: project.settings,
    customSource: {
      modulesInput: "modules",
      extensionsInput: "extensions",
      supported: true,
    },
  }
}

function assertValidVoyantProject(project: unknown): asserts project is VoyantProjectManifest {
  const result = validateVoyantProject(project)
  if (!result.ok) {
    throw new Error(
      `Invalid Voyant managed profile:\n${result.issues
        .map((issue) => `- ${issue.path || "<root>"}: ${issue.message}`)
        .join("\n")}`,
    )
  }
}

function normalizeModules(modules: readonly string[] | undefined): string[] {
  if (!modules) return []
  return unique(modules.map((ref) => moduleIdFromReference(ref, "module")))
}

function normalizePlugins(plugins: readonly string[] | undefined): string[] {
  if (!plugins) return []
  return unique(plugins.map((plugin) => plugin.trim()))
}

function normalizeSettings(settings: unknown): VoyantProjectSettings {
  if (settings == null) return {}
  if (!isRecord(settings) || !isJsonValue(settings)) {
    throw new Error("Voyant project settings must be a JSON-serializable object.")
  }
  return cloneJsonObject(settings)
}

function projectFromValidatedRecord(input: Record<string, unknown>): VoyantProjectManifest {
  return {
    schemaVersion: VOYANT_PROJECT_SCHEMA_VERSION,
    profile: "operator",
    frameworkVersion: input.frameworkVersion as string,
    mode: input.mode as VoyantProjectDeploymentMode,
    ...(typeof input.region === "string" && input.region ? { region: input.region } : {}),
    modules: normalizeModules(input.modules as readonly string[] | undefined),
    plugins: normalizePlugins(input.plugins as readonly string[] | undefined),
    settings: isRecord(input.settings) ? cloneJsonObject(input.settings) : {},
    ...(input.providers ? { providers: input.providers as VoyantProjectProviders } : {}),
    admin: input.admin as VoyantProjectAdminManifest,
    ...(input.customSource
      ? { customSource: input.customSource as VoyantProjectCustomSourceManifest }
      : {}),
  }
}

function computeCreateVoyantAppExclude(project: VoyantProjectManifest): string[] {
  const excluded = new Set<string>()
  const include = project.modules.length > 0 ? project.modules : OPERATOR_DEFAULT_MODULE_SPECIFIERS

  if (project.mode === "managed-cloud" && project.modules.length > 0) {
    const unsupported = project.modules
      .map((ref) => moduleSpecifierFromReference(ref, "module"))
      .filter((specifier) => FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIER_SET.has(specifier))
    if (unsupported.length > 0) {
      throw new Error(
        `Managed Cloud source-free profiles cannot include starter-local module(s): ${unique(
          unsupported,
        ).join(", ")}.`,
      )
    }
  }

  if (include.length > 0) {
    const includedSpecifiers = new Set<string>(
      include.map((ref) => moduleSpecifierFromReference(ref, "module")),
    )
    for (const definition of VOYANT_PROFILE_MODULES) {
      if (definition.kind === "module" && definition.required) {
        includedSpecifiers.add(definition.specifier)
      }
    }
    for (const specifier of FRAMEWORK_RUNTIME_MANIFEST.modules) {
      if (!includedSpecifiers.has(specifier)) excluded.add(specifier)
    }
  }

  for (const extension of ownedExtensionsForExcludedModules(excluded)) {
    excluded.add(extension)
  }

  if (project.mode === "managed-cloud") {
    for (const specifier of FRAMEWORK_SOURCE_FREE_UNSUPPORTED_SPECIFIER_SET) {
      excluded.add(specifier)
    }
  }

  const ordered = [
    ...FRAMEWORK_RUNTIME_MANIFEST.modules,
    ...FRAMEWORK_RUNTIME_MANIFEST.extensions,
  ].filter((specifier) => excluded.has(specifier))

  subsetStandardManifest({ exclude: ordered })
  return ordered
}

function resolvedExcludedModuleIds(project: VoyantProjectManifest): string[] {
  return computeCreateVoyantAppExclude(project).map(moduleIdFromSpecifier)
}

function providersForProject(project: VoyantProjectManifest): VoyantProjectProviders {
  if (project.mode === "managed-cloud") return MANAGED_OPERATOR_DEFAULT_PROVIDERS
  if (!project.providers) throw new Error(`${project.mode} profiles must declare providers.`)
  return project.providers
}

function mergeResourceRequirements(
  resources: readonly VoyantProfileResourceRequirement[],
): VoyantProfileResourceRequirement[] {
  const merged = new Map<string, VoyantProfileResourceRequirement>()
  for (const resource of resources) {
    const key = `${resource.resourceKey}:${resource.provider}:${resource.required}`
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, resource)
      continue
    }
    merged.set(key, {
      ...existing,
      roles: unique([...existing.roles, ...resource.roles]),
      env: mergeEnvRequirements(existing.env, resource.env),
      ...mergeNotes(existing.notes, resource.notes),
    })
  }
  return [...merged.values()]
}

function mergeEnvRequirements(
  left: readonly VoyantProfileEnvRequirement[],
  right: readonly VoyantProfileEnvRequirement[],
): VoyantProfileEnvRequirement[] {
  const merged = new Map<string, VoyantProfileEnvRequirement>()
  for (const env of [...left, ...right]) {
    const key = `${env.kind}:${env.name}`
    const existing = merged.get(key)
    merged.set(key, existing ? { ...existing, required: existing.required || env.required } : env)
  }
  return [...merged.values()]
}

function mergeNotes(left: string | undefined, right: string | undefined): { notes?: string } {
  const notes = unique([left, right].filter((note): note is string => Boolean(note)))
  return notes.length > 0 ? { notes: notes.join(" ") } : {}
}

function issueResult(
  path: string,
  code: VoyantProfileValidationIssue["code"],
  message: string,
): VoyantProfileValidationResult {
  return { ok: false, issues: [{ path, code, message }] }
}

function cloneJsonObject(value: Record<string, unknown>): VoyantProjectSettings {
  return JSON.parse(JSON.stringify(value)) as VoyantProjectSettings
}

function unique<T>(items: readonly T[]): T[] {
  return [...new Set(items)]
}

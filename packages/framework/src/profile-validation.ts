import {
  moduleDefinitionFromReference,
  PROVIDER_CONTRACTS,
  PROVIDER_ROLES,
  VOYANT_PROJECT_SCHEMA_VERSION,
  type VoyantProfileValidationIssue,
  type VoyantProjectJsonValue,
} from "./profile-types.js"

const CUSTOMER_APP_MODULE_SPECIFIERS = new Set([
  "@voyant-travel/storefront",
  "@voyant-travel/storefront/customer-portal",
  "@voyant-travel/storefront/verification",
])

export function validateVoyantProjectRecord(
  input: Record<string, unknown>,
): VoyantProfileValidationIssue[] {
  const issues: VoyantProfileValidationIssue[] = []

  if (input.schemaVersion !== VOYANT_PROJECT_SCHEMA_VERSION) {
    issues.push({
      path: "schemaVersion",
      code: input.schemaVersion == null ? "missing_required" : "invalid_value",
      message: `schemaVersion must be "${VOYANT_PROJECT_SCHEMA_VERSION}".`,
    })
  }

  if (input.profile !== "operator") {
    issues.push({
      path: "profile",
      code: input.profile == null ? "missing_required" : "invalid_value",
      message: 'profile must be "operator".',
    })
  }

  if (!isNonEmptyString(input.frameworkVersion)) {
    issues.push({
      path: "frameworkVersion",
      code: input.frameworkVersion == null ? "missing_required" : "invalid_type",
      message: "frameworkVersion must be a non-empty string.",
    })
  }

  const mode = input.mode
  if (mode !== "managed-cloud" && mode !== "self-hosted" && mode !== "local") {
    issues.push({
      path: "mode",
      code: mode == null ? "missing_required" : "invalid_value",
      message: 'mode must be "managed-cloud", "self-hosted", or "local".',
    })
  }

  validateProviders(input.providers, mode, issues)
  validateModules(input.modules, issues)
  validatePlugins(input.plugins, issues)
  validateSettings(input.settings, issues)
  validateAdmin(input.admin, issues)
  validateCustomSource(input.customSource, issues)
  validateNoWebsiteArtifacts(input.websites, issues)

  return issues
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

export function isJsonValue(value: unknown): value is VoyantProjectJsonValue {
  if (value == null) return true
  if (typeof value === "boolean" || typeof value === "string") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isJsonValue)
  if (!isRecord(value)) return false
  return Object.values(value).every(isJsonValue)
}

function validateProviders(
  providers: unknown,
  mode: unknown,
  issues: VoyantProfileValidationIssue[],
) {
  if (mode === "managed-cloud") {
    if (providers != null) {
      issues.push({
        path: "providers",
        code: "incompatible_provider",
        message:
          "Managed Cloud profile substrate is framework-owned; omit providers and read resource requirements from the profile contract.",
      })
    }
    return
  }

  if (!isRecord(providers)) {
    issues.push({
      path: "providers",
      code: providers == null ? "missing_required" : "invalid_type",
      message: "providers must be an object for self-hosted and local profiles.",
    })
    return
  }

  for (const role of PROVIDER_ROLES) {
    const value = providers[role]
    const allowed = PROVIDER_CONTRACTS[role]
    if (typeof value !== "string") {
      issues.push({
        path: `providers.${role}`,
        code: value == null ? "missing_required" : "invalid_type",
        message: `providers.${role} must be one of: ${allowed.join(", ")}.`,
      })
      continue
    }
    if (!allowed.includes(value as never)) {
      issues.push({
        path: `providers.${role}`,
        code: "invalid_value",
        message: `Unsupported ${role} provider "${value}". Supported providers: ${allowed.join(
          ", ",
        )}.`,
      })
    }
  }
}

function validateModules(modules: unknown, issues: VoyantProfileValidationIssue[]) {
  if (modules == null) return
  if (!Array.isArray(modules)) {
    issues.push({
      path: "modules",
      code: "invalid_type",
      message: "modules must be an array.",
    })
    return
  }
  validateModuleArray(modules, "modules", issues)
}

function validatePlugins(plugins: unknown, issues: VoyantProfileValidationIssue[]) {
  if (plugins == null) return
  if (!Array.isArray(plugins)) {
    issues.push({
      path: "plugins",
      code: "invalid_type",
      message: "plugins must be an array.",
    })
    return
  }
  plugins.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push({
        path: `plugins[${index}]`,
        code: "invalid_type",
        message: "Plugin references must be non-empty strings.",
      })
    }
  })
}

function validateSettings(settings: unknown, issues: VoyantProfileValidationIssue[]) {
  if (settings == null) return
  if (!isRecord(settings) || !isJsonValue(settings)) {
    issues.push({
      path: "settings",
      code: "non_serializable",
      message: "settings must be a JSON-serializable object owned by modules or plugins.",
    })
  }
}

function validateModuleArray(
  value: readonly unknown[],
  path: string,
  issues: VoyantProfileValidationIssue[],
) {
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push({
        path: `${path}[${index}]`,
        code: "invalid_type",
        message: "Module references must be non-empty strings.",
      })
      return
    }
    if (!moduleDefinitionFromReference(entry, "module")) {
      issues.push({
        path: `${path}[${index}]`,
        code: "unknown_module",
        message: `Unknown standard framework module "${entry}".`,
      })
      return
    }
    const definition = moduleDefinitionFromReference(entry, "module")
    if (definition && CUSTOMER_APP_MODULE_SPECIFIERS.has(definition.specifier)) {
      issues.push({
        path: `${path}[${index}]`,
        code: "invalid_value",
        message:
          "Customer-facing website modules are separate Cloud app artifacts and are not part of the managed operator profile.",
      })
    }
  })
}

function validateAdmin(admin: unknown, issues: VoyantProfileValidationIssue[]) {
  if (!isRecord(admin)) {
    issues.push({
      path: "admin",
      code: admin == null ? "missing_required" : "invalid_type",
      message: "admin must be an object.",
    })
    return
  }
  if (typeof admin.enabled !== "boolean") {
    issues.push({
      path: "admin.enabled",
      code: admin.enabled == null ? "missing_required" : "invalid_type",
      message: "admin.enabled must be a boolean.",
    })
  }
  if (!isNonEmptyString(admin.path) || !admin.path.startsWith("/")) {
    issues.push({
      path: "admin.path",
      code: admin.path == null ? "missing_required" : "invalid_value",
      message: 'admin.path must be an absolute path such as "/app".',
    })
  }
}

function validateCustomSource(customSource: unknown, issues: VoyantProfileValidationIssue[]) {
  if (customSource == null) return
  if (!isRecord(customSource)) {
    issues.push({
      path: "customSource",
      code: "invalid_type",
      message: "customSource must be an object with optional modules/extensions arrays.",
    })
    return
  }
  validateStringArray(customSource.modules, "customSource.modules", issues)
  validateStringArray(customSource.extensions, "customSource.extensions", issues)
}

function validateStringArray(value: unknown, path: string, issues: VoyantProfileValidationIssue[]) {
  if (value == null) return
  if (!Array.isArray(value)) {
    issues.push({
      path,
      code: "invalid_type",
      message: `${path} must be an array of package names.`,
    })
    return
  }
  value.forEach((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      issues.push({
        path: `${path}[${index}]`,
        code: "invalid_type",
        message: `${path} entries must be non-empty package-name strings.`,
      })
    }
  })
}

function validateNoWebsiteArtifacts(websites: unknown, issues: VoyantProfileValidationIssue[]) {
  if (websites != null) {
    issues.push({
      path: "websites",
      code: "invalid_value",
      message:
        "websites are not part of the managed operator profile; model customer-facing apps as separate Cloud app artifacts.",
    })
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

import type {
  VoyantGraphRuntime,
  VoyantGraphRuntimeConfigLoader,
  VoyantGraphRuntimeProviderLoader,
  VoyantGraphRuntimeResourceDefinition,
  VoyantGraphRuntimeSecretLoader,
} from "./runtime-lowering.js"

export const VOYANT_GRAPH_RUNTIME_VALUE_ERROR_CODES = {
  VOYANT_GRAPH_RUNTIME_VALUE_REQUIRED: "A required graph runtime value is missing.",
  VOYANT_GRAPH_RUNTIME_VALUE_INVALID: "A graph runtime value failed its admitted validator.",
  VOYANT_GRAPH_RUNTIME_VALIDATOR_INVALID:
    "A graph runtime validator export does not implement a supported schema interface.",
} as const

export type VoyantGraphRuntimeValueErrorCode = keyof typeof VOYANT_GRAPH_RUNTIME_VALUE_ERROR_CODES

export interface VoyantGraphRuntimeValueIssue {
  code: VoyantGraphRuntimeValueErrorCode
  unitId: string
  declarationId: string
  facet: "config" | "secrets"
  key: string
}

export class VoyantGraphRuntimeValueError extends Error {
  readonly issues: readonly VoyantGraphRuntimeValueIssue[]

  constructor(issues: readonly VoyantGraphRuntimeValueIssue[]) {
    super(formatRuntimeValueIssues(issues))
    this.name = "VoyantGraphRuntimeValueError"
    this.issues = issues
  }
}

export interface ResolveVoyantGraphRuntimeValuesInput {
  /**
   * Node deployment values. Secret declarations read only from this record;
   * config declarations use it after unit project config and before defaults.
   */
  deploymentValues?: Readonly<Record<string, unknown>>
  /** Compatible deployment names, keyed by the declaration's canonical key. */
  deploymentValueAliases?: Readonly<Record<string, readonly string[]>>
}

export interface ResolvedVoyantGraphRuntimeConfig {
  unitId: string
  declarationId: string
  key: string
  value: unknown
}

export interface ResolvedVoyantGraphRuntimeSecret {
  unitId: string
  declarationId: string
  key: string
}

export interface ResolvedVoyantGraphRuntimeValues {
  graphHash: string
  config: readonly ResolvedVoyantGraphRuntimeConfig[]
  /** Secret metadata only. Values are intentionally non-enumerable. */
  secrets: readonly ResolvedVoyantGraphRuntimeSecret[]
  resources: readonly VoyantGraphRuntimeResourceDefinition[]
  providers: readonly VoyantGraphRuntimeProviderLoader[]
  getConfig: <T = unknown>(declarationId: string) => T | undefined
  getSecret: <T = unknown>(declarationId: string) => T | undefined
}

/**
 * Resolve and validate graph-owned Node runtime values before composition.
 * Validator and provider package bodies remain lazy until this resolver or a
 * provider consumer explicitly requests their admitted export.
 */
export async function resolveVoyantGraphRuntimeValues(
  runtime: VoyantGraphRuntime,
  input: ResolveVoyantGraphRuntimeValuesInput = {},
): Promise<ResolvedVoyantGraphRuntimeValues> {
  const deploymentValues = input.deploymentValues ?? {}
  const deploymentValueAliases = input.deploymentValueAliases ?? {}
  const unitConfig = new Map(
    [...runtime.modules, ...runtime.extensions, ...runtime.plugins].map((unit) => [
      unit.id,
      unit.projectConfig ?? {},
    ]),
  )
  const configValues = new Map<string, unknown>()
  const secretValues = new Map<string, unknown>()
  const config: ResolvedVoyantGraphRuntimeConfig[] = []
  const secrets: ResolvedVoyantGraphRuntimeSecret[] = []
  const issues: VoyantGraphRuntimeValueIssue[] = []
  const providerRequirements = selectedProviderRuntimeValueRequirements(runtime)

  for (const definition of runtime.config) {
    const declaration = definition.declaration
    const authored = valueAtKey(unitConfig.get(definition.unitId) ?? {}, declaration.key)
    const deployed = deploymentValueAtKey(
      deploymentValues,
      declaration.key,
      deploymentValueAliases[declaration.key] ?? [],
    )
    const candidate =
      authored !== undefined ? authored : deployed !== undefined ? deployed : declaration.default
    const resolved = await validateRuntimeValue(
      definition,
      "config",
      candidate,
      issues,
      isRuntimeValueRequired(declaration, providerRequirements.config),
    )
    configValues.set(declaration.id, resolved)
    if (resolved !== undefined) {
      config.push({
        unitId: definition.unitId,
        declarationId: declaration.id,
        key: declaration.key,
        value: resolved,
      })
    }
  }

  for (const definition of runtime.secrets) {
    const declaration = definition.declaration
    const candidate = deploymentValueAtKey(
      deploymentValues,
      declaration.key,
      deploymentValueAliases[declaration.key] ?? [],
    )
    const resolved = await validateRuntimeValue(
      definition,
      "secrets",
      candidate,
      issues,
      isRuntimeValueRequired(declaration, providerRequirements.secrets),
    )
    secretValues.set(declaration.id, resolved)
    secrets.push({
      unitId: definition.unitId,
      declarationId: declaration.id,
      key: declaration.key,
    })
  }

  if (issues.length > 0) throw new VoyantGraphRuntimeValueError(issues)

  const knownConfig = new Set(runtime.config.map(({ declaration }) => declaration.id))
  const knownSecrets = new Set(runtime.secrets.map(({ declaration }) => declaration.id))
  return {
    graphHash: runtime.graphHash,
    config,
    secrets,
    resources: runtime.resources,
    providers: runtime.providers,
    getConfig: <T = unknown>(declarationId: string): T | undefined => {
      assertKnownDeclaration(knownConfig, declarationId, "config")
      return configValues.get(declarationId) as T | undefined
    },
    getSecret: <T = unknown>(declarationId: string): T | undefined => {
      assertKnownDeclaration(knownSecrets, declarationId, "secret")
      return secretValues.get(declarationId) as T | undefined
    },
  }
}

async function validateRuntimeValue(
  definition: VoyantGraphRuntimeConfigLoader | VoyantGraphRuntimeSecretLoader,
  facet: "config" | "secrets",
  candidate: unknown,
  issues: VoyantGraphRuntimeValueIssue[],
  required: boolean,
): Promise<unknown> {
  const { declaration } = definition
  if (!hasRuntimeValue(candidate)) {
    if (required) issues.push(valueIssue(definition, facet, "required"))
    return undefined
  }
  if (!definition.loadValidator) return candidate

  const validator = await definition.loadValidator()
  if (!isRuntimeValidator(validator)) {
    issues.push(valueIssue(definition, facet, "validator"))
    return undefined
  }

  try {
    const result = await parseRuntimeValue(validator, candidate)
    if (!result.ok) {
      issues.push(valueIssue(definition, facet, "invalid"))
      return undefined
    }
    return result.value
  } catch {
    issues.push(valueIssue(definition, facet, "invalid"))
    return undefined
  }
}

interface ProviderRuntimeValueRequirements {
  owned: ReadonlySet<string>
  selected: ReadonlySet<string>
}

function selectedProviderRuntimeValueRequirements(runtime: VoyantGraphRuntime): {
  config: ProviderRuntimeValueRequirements
  secrets: ProviderRuntimeValueRequirements
} {
  const config = { owned: new Set<string>(), selected: new Set<string>() }
  const secrets = { owned: new Set<string>(), selected: new Set<string>() }
  for (const { declaration } of runtime.providers) {
    const selection = declaration.selection
    const isSelected =
      selection !== undefined && runtime.providerSelections[selection.role] === selection.value
    for (const id of declaration.uses?.config ?? []) {
      config.owned.add(id)
      if (isSelected) config.selected.add(id)
    }
    for (const id of declaration.uses?.secrets ?? []) {
      secrets.owned.add(id)
      if (isSelected) secrets.selected.add(id)
    }
  }
  return { config, secrets }
}

function isRuntimeValueRequired(
  declaration: { id: string; required?: boolean },
  requirements: ProviderRuntimeValueRequirements,
): boolean {
  return (
    declaration.required === true &&
    (!requirements.owned.has(declaration.id) || requirements.selected.has(declaration.id))
  )
}

type RuntimeValidator = Record<string, unknown> & {
  safeParseAsync?: (value: unknown) => Promise<unknown>
  safeParse?: (value: unknown) => unknown
  parseAsync?: (value: unknown) => Promise<unknown>
  parse?: (value: unknown) => unknown
}

function isRuntimeValidator(value: unknown): value is RuntimeValidator {
  if (!value || typeof value !== "object") return false
  const validator = value as RuntimeValidator
  return (
    typeof validator.safeParseAsync === "function" ||
    typeof validator.safeParse === "function" ||
    typeof validator.parseAsync === "function" ||
    typeof validator.parse === "function"
  )
}

async function parseRuntimeValue(
  validator: RuntimeValidator,
  candidate: unknown,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  if (validator.safeParseAsync) {
    return normalizeSafeParseResult(await validator.safeParseAsync(candidate))
  }
  if (validator.safeParse) return normalizeSafeParseResult(validator.safeParse(candidate))
  if (validator.parseAsync) return { ok: true, value: await validator.parseAsync(candidate) }
  return { ok: true, value: validator.parse!(candidate) }
}

function normalizeSafeParseResult(result: unknown): { ok: true; value: unknown } | { ok: false } {
  if (!result || typeof result !== "object" || !("success" in result)) return { ok: false }
  const parsed = result as { success: unknown; data?: unknown }
  return parsed.success === true ? { ok: true, value: parsed.data } : { ok: false }
}

function valueAtKey(source: Readonly<Record<string, unknown>>, key: string): unknown {
  if (Object.hasOwn(source, key)) return source[key]
  let current: unknown = source
  for (const segment of key.split(".")) {
    if (!current || typeof current !== "object" || Array.isArray(current)) return undefined
    const record = current as Readonly<Record<string, unknown>>
    if (!Object.hasOwn(record, segment)) return undefined
    current = record[segment]
  }
  return current
}

function deploymentValueAtKey(
  source: Readonly<Record<string, unknown>>,
  key: string,
  aliases: readonly string[],
): unknown {
  const canonical = valueAtKey(source, key)
  if (canonical !== undefined) return canonical
  for (const alias of aliases) {
    const value = valueAtKey(source, alias)
    if (value !== undefined) return value
  }
  return undefined
}

function hasRuntimeValue(value: unknown): boolean {
  return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined
}

function valueIssue(
  definition: VoyantGraphRuntimeConfigLoader | VoyantGraphRuntimeSecretLoader,
  facet: "config" | "secrets",
  kind: "invalid" | "required" | "validator",
): VoyantGraphRuntimeValueIssue {
  return {
    code:
      kind === "required"
        ? "VOYANT_GRAPH_RUNTIME_VALUE_REQUIRED"
        : kind === "validator"
          ? "VOYANT_GRAPH_RUNTIME_VALIDATOR_INVALID"
          : "VOYANT_GRAPH_RUNTIME_VALUE_INVALID",
    unitId: definition.unitId,
    declarationId: definition.declaration.id,
    facet,
    key: definition.declaration.key,
  }
}

function assertKnownDeclaration(
  known: ReadonlySet<string>,
  declarationId: string,
  facet: "config" | "secret",
): void {
  if (!known.has(declarationId)) {
    throw new Error(`Unknown graph runtime ${facet} declaration "${declarationId}".`)
  }
}

function formatRuntimeValueIssues(issues: readonly VoyantGraphRuntimeValueIssue[]): string {
  const details = issues.map(
    (issue) =>
      `- ${issue.code}: ${issue.unitId} ${issue.facet} "${issue.key}" (${issue.declarationId})`,
  )
  return `Voyant graph runtime values are not valid:\n${details.join("\n")}`
}

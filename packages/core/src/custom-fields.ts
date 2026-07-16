/**
 * Custom fields — a typed, validated, visibility-aware extension-field registry
 * for core entities (consolidated-deployments RFC, the "20%": custom fields
 * without forking).
 *
 * The common client ask is "add a few fields to bookings / people / products".
 * The free-form `metadata` jsonb most entities already carry is the unstructured
 * escape hatch (Medusa's model); this registry turns a *declared* subset of that
 * space into fields that are:
 *   - **validated** on write (type / required / options / custom rule),
 *   - **visibility-aware** — each field declares whether it surfaces in exports,
 *     invoices, and search, so those readers can consult the registry instead of
 *     dumping or hiding everything,
 *   - **PII-aware** — flagged fields can be encrypted at rest / redacted in logs.
 *
 * Runtime definitions are persisted in `custom_field_definitions` and resolved
 * from the database on each request. This module remains dependency-free and
 * owns the registry, validation, and visibility primitives shared by consumers.
 * Legacy project-authoring helpers remain temporarily for source compatibility,
 * but they have no runtime authority.
 */

/**
 * The supported types a custom field can hold — the canonical superset across
 * code-declared and runtime (DB-defined) fields (see the custom-fields
 * unification ADR). Runtime equivalents map in: `varchar`→`text`, `double`→
 * `number`, `enum`→`select`, `set`→`multiselect`, `address`/`phone`→`json`.
 */
export type CustomFieldType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  /** One of `options`. */
  | "select"
  /** A subset of `options`, stored as `string[]`. */
  | "multiselect"
  /** Money as `{ amountCents: number, currency: string }` (ISO-4217). */
  | "monetary"
  /** Arbitrary JSON (object/array) — also the home for `address`/`phone`. */
  | "json"

/** A monetary custom-field value: integer minor units + an ISO-4217 currency. */
export interface CustomFieldMonetaryValue {
  amountCents: number
  currency: string
}

/**
 * Per-channel visibility. Defaults (when a channel is unset) are deliberately
 * conservative: visible in exports, hidden from invoices and search.
 */
export interface CustomFieldVisibility {
  /** Surface in data exports (CSV/JSON). Default `true`. */
  export?: boolean
  /** Render on generated invoices. Default `false` (invoices are customer-facing). */
  invoice?: boolean
  /** Index for search. Default `false`. */
  search?: boolean
}

/** A single custom-field declaration attached to one entity. */
export interface CustomFieldDefinition {
  /** Entity the field attaches to, e.g. `"booking"`, `"person"`, `"product"`. */
  entity: string
  /** Stable key within the entity's custom-field namespace (typo-proof). */
  key: string
  type: CustomFieldType
  /** Human label — an i18n key or literal. */
  label: string
  /** Reject writes that omit this field. Default `false`. */
  required?: boolean
  /** Allowed values for `type: "select"`. */
  options?: ReadonlyArray<string>
  /** Sensitive data — the deployment should encrypt at rest / redact in logs. */
  pii?: boolean
  visibility?: CustomFieldVisibility
  /**
   * Extra validation beyond type/required/options. Return an error message to
   * reject, or `null` to accept. Runs only when a value is present.
   */
  validate?: (value: unknown) => string | null
}

/**
 * Identity helper retained temporarily for source compatibility.
 *
 * @deprecated Project-local TypeScript definitions have no runtime authority.
 * Create operator definitions through Settings.
 */
export function defineCustomField<T extends CustomFieldDefinition>(definition: T): T {
  return definition
}

/** A resolved, indexed set of custom-field declarations. */
export interface CustomFieldRegistry {
  /** All fields declared for `entity`, in declaration order. */
  forEntity(entity: string): CustomFieldDefinition[]
  /** A single field by `(entity, key)`, or `undefined`. */
  field(entity: string, key: string): CustomFieldDefinition | undefined
  /** Entities that have at least one field. */
  entities(): string[]
  /** Every declared field. */
  all(): CustomFieldDefinition[]
}

/**
 * Resolve the registry for a request. Runtime definitions come exclusively from
 * the `custom_field_definitions` table, so the registry is resolved per request
 * from a `db` handle rather than being a boot-time constant. `db` is `unknown`
 * to keep `core` free of a Drizzle dependency.
 */
export type CustomFieldRegistryResolver = (
  db: unknown,
) => CustomFieldRegistry | Promise<CustomFieldRegistry>

export type CustomFieldVisibilityChannel = keyof CustomFieldVisibility

export type { CustomFieldsRuntime } from "./runtime-port.js"
export { customFieldsRuntimePort } from "./runtime-port.js"

const VISIBILITY_DEFAULTS: Required<CustomFieldVisibility> = {
  export: true,
  invoice: false,
  search: false,
}

/**
 * Build a {@link CustomFieldRegistry} from declarations. Throws on a duplicate
 * `(entity, key)` — a collision is a config bug, not something to resolve
 * silently.
 */
export function createCustomFieldRegistry(
  definitions: ReadonlyArray<CustomFieldDefinition>,
): CustomFieldRegistry {
  const byEntity = new Map<string, CustomFieldDefinition[]>()
  const seen = new Set<string>()
  for (const def of definitions) {
    const id = `${def.entity}.${def.key}`
    if (seen.has(id)) {
      throw new Error(`[voyant-custom-fields] duplicate custom field "${id}"`)
    }
    seen.add(id)
    const list = byEntity.get(def.entity) ?? []
    list.push(def)
    byEntity.set(def.entity, list)
  }
  return {
    forEntity: (entity) => [...(byEntity.get(entity) ?? [])],
    field: (entity, key) => byEntity.get(entity)?.find((f) => f.key === key),
    entities: () => [...byEntity.keys()],
    all: () => [...definitions],
  }
}

/**
 * Merge custom-field declarations from several sources into one duplicate-free
 * list. Retained only for source compatibility; runtime registry composition
 * must load persisted definitions directly.
 *
 * @deprecated Runtime custom-field definitions are database-owned. This helper
 * will be removed with the legacy local-definition surface.
 */
export function mergeCustomFieldDefinitions(
  sources: ReadonlyArray<ReadonlyArray<CustomFieldDefinition>>,
  onShadow?: (shadowed: CustomFieldDefinition, winner: CustomFieldDefinition) => void,
): CustomFieldDefinition[] {
  const winners = new Map<string, CustomFieldDefinition>()
  for (const source of sources) {
    for (const def of source) {
      const id = `${def.entity}.${def.key}`
      const existing = winners.get(id)
      if (existing) {
        onShadow?.(def, existing)
        continue
      }
      winners.set(id, def)
    }
  }
  return [...winners.values()]
}

/** Fields of `entity` visible in `channel` (export / invoice / search). */
export function customFieldsVisibleIn(
  registry: CustomFieldRegistry,
  entity: string,
  channel: keyof CustomFieldVisibility,
): CustomFieldDefinition[] {
  return registry
    .forEntity(entity)
    .filter((f) => f.visibility?.[channel] ?? VISIBILITY_DEFAULTS[channel])
}

/** One field's validation failure. */
export interface CustomFieldError {
  key: string
  message: string
}

/** The outcome of {@link validateCustomFields}. */
export interface CustomFieldValidationResult {
  ok: boolean
  /** Validated values, unknown/absent keys dropped. Only meaningful when `ok`. */
  value: Record<string, unknown>
  errors: CustomFieldError[]
}

function checkType(def: CustomFieldDefinition, value: unknown): string | null {
  switch (def.type) {
    case "text":
      return typeof value === "string" ? null : "must be a string"
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : "must be a finite number"
    case "boolean":
      return typeof value === "boolean" ? null : "must be a boolean"
    case "date":
      if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? "must be a valid date" : null
      }
      return typeof value === "string" && !Number.isNaN(Date.parse(value))
        ? null
        : "must be an ISO date string"
    case "select":
      return typeof value === "string" && (def.options ?? []).includes(value)
        ? null
        : `must be one of: ${(def.options ?? []).join(", ")}`
    case "multiselect": {
      const allowed = def.options ?? []
      if (
        !Array.isArray(value) ||
        value.some((v) => typeof v !== "string" || !allowed.includes(v))
      ) {
        return `must be a subset of: ${allowed.join(", ")}`
      }
      return null
    }
    case "monetary": {
      const v = value as Partial<CustomFieldMonetaryValue>
      const ok =
        typeof value === "object" &&
        value !== null &&
        typeof v.amountCents === "number" &&
        Number.isInteger(v.amountCents) &&
        typeof v.currency === "string" &&
        v.currency.length === 3
      return ok ? null : "must be { amountCents: integer, currency: 3-letter code }"
    }
    case "json":
      // Arbitrary JSON (incl. address/phone). Reject only `undefined`; `null`
      // is already handled as "omitted" by the caller.
      return value === undefined ? "must be a JSON value" : null
  }
}

/**
 * Validate a custom-fields payload for `entity` against the registry. Unknown
 * keys are rejected (typo-proofing), missing required fields error, present
 * values are type/options/custom-rule checked. `null`/`undefined` values for a
 * non-required field are treated as "omitted". Returns the cleaned value and any
 * errors — callers persist `value` (e.g. into the entity's `custom_fields` or
 * `metadata` jsonb) only when `ok`.
 */
export function validateCustomFields(
  registry: CustomFieldRegistry,
  entity: string,
  input: Record<string, unknown> | null | undefined,
): CustomFieldValidationResult {
  const provided = input ?? {}
  const fields = registry.forEntity(entity)
  const known = new Set(fields.map((f) => f.key))
  const errors: CustomFieldError[] = []
  const value: Record<string, unknown> = {}

  for (const key of Object.keys(provided)) {
    if (!known.has(key)) {
      errors.push({ key, message: `unknown custom field for "${entity}"` })
    }
  }

  for (const def of fields) {
    const raw = provided[def.key]
    const absent = raw === null || raw === undefined
    if (absent) {
      if (def.required) {
        errors.push({ key: def.key, message: "is required" })
      }
      continue
    }
    const typeError = checkType(def, raw)
    if (typeError) {
      errors.push({ key: def.key, message: typeError })
      continue
    }
    const customError = def.validate?.(raw)
    if (customError) {
      errors.push({ key: def.key, message: customError })
      continue
    }
    value[def.key] = raw
  }

  return { ok: errors.length === 0, value, errors }
}

/**
 * Discover deployment-local custom-field declarations from a Vite
 * `import.meta.glob` (eager) of `src/custom-fields/*.ts` files — the custom-field
 * half of the "extend without forking" seam (mirrors `modulesFromGlob` etc.).
 * Each file's `default` export is a {@link CustomFieldDefinition} or an array of
 * them; the results flatten into one list to feed
 * {@link createCustomFieldRegistry}. Empty until a deployment adds one.
 *
 * @deprecated Project-local TypeScript definitions have no runtime authority.
 * @throws if a matched file has no default export.
 */
export function customFieldsFromGlob(glob: Record<string, unknown>): CustomFieldDefinition[] {
  return Object.entries(glob)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([path, namespace]) => {
      const declaration = (namespace as { default?: unknown }).default
      if (declaration == null) {
        throw new Error(
          `[voyant-custom-fields] "${path}" has no default export — ` +
            "export default defineCustomField(...) (or an array of them)",
        )
      }
      return Array.isArray(declaration)
        ? (declaration as CustomFieldDefinition[])
        : [declaration as CustomFieldDefinition]
    })
}

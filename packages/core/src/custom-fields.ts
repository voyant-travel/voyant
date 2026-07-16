/**
 * Custom fields — a typed, validated, visibility-aware extension-field registry
 * for core entities (consolidated-deployments RFC, the "20%": custom fields
 * without forking).
 *
 * The common client ask is "add a few fields to bookings / people / products".
 * The free-form `metadata` jsonb most entities already carry is the unstructured
 * escape hatch (Medusa's model); this registry turns a *declared* subset of that
 * space into fields that are:
 *   - **validated** on write (type / required / options),
 *   - **visibility-aware** — each field declares whether it surfaces in exports,
 *     invoices, and search, so those readers can consult the registry instead of
 *     dumping or hiding everything,
 *   - **PII-aware** — flagged fields can be encrypted at rest / redacted in logs.
 *
 * Runtime definitions are persisted in `custom_field_definitions` and resolved
 * from the database on each request. This module remains dependency-free and
 * owns the registry, validation, and visibility primitives shared by consumers.
 */

/**
 * The supported types a custom field can hold — the canonical persisted
 * definition model (see the custom-fields unification ADR). Runtime equivalents
 * map in: `varchar`→`text`, `double`→
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
  /** Physical owner namespace. Together with entity + key this is the identity. */
  namespace: string
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
}

/** A resolved, indexed set of custom-field declarations. */
export interface CustomFieldRegistry {
  /** All fields declared for `entity`, in declaration order. */
  forEntity(entity: string): CustomFieldDefinition[]
  /** A single field by `(entity, namespace, key)`, or `undefined`. */
  field(entity: string, namespace: string, key: string): CustomFieldDefinition | undefined
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

export type {
  CustomFieldsRuntime,
  CustomFieldValueDefinitionContext,
  CustomFieldValueDefinitionIdentity,
  CustomFieldValueEntityValues,
  CustomFieldValueLifecycleRuntime,
  CustomFieldValueOperationsRuntime,
  CustomFieldValueOwnerContext,
  CustomFieldValueReaderRuntime,
} from "./runtime-port.js"
export {
  customFieldsRuntimePort,
  customFieldValueLifecycleRuntimePort,
  customFieldValueOperationsRuntimePort,
  customFieldValueReaderRuntimePort,
} from "./runtime-port.js"

const VISIBILITY_DEFAULTS: Required<CustomFieldVisibility> = {
  export: true,
  invoice: false,
  search: false,
}

/**
 * Build a {@link CustomFieldRegistry} from declarations. Throws on a duplicate
 * `(entity, namespace, key)` — a collision is a config bug, not something to resolve
 * silently.
 */
export function createCustomFieldRegistry(
  definitions: ReadonlyArray<CustomFieldDefinition>,
): CustomFieldRegistry {
  const byEntity = new Map<string, CustomFieldDefinition[]>()
  const seen = new Set<string>()
  for (const def of definitions) {
    const id = `${def.entity}.${def.namespace}.${def.key}`
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
    field: (entity, namespace, key) =>
      byEntity.get(entity)?.find((f) => f.namespace === namespace && f.key === key),
    entities: () => [...byEntity.keys()],
    all: () => [...definitions],
  }
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
  namespace: string
  key: string
  message: string
}

/** The outcome of {@link validateCustomFields}. */
export interface CustomFieldValidationResult {
  ok: boolean
  /** Validated values, unknown/absent keys dropped. Only meaningful when `ok`. */
  value: NamespacedCustomFieldValues
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
 * values are type/options checked. `null`/`undefined` values for a
 * non-required field are treated as "omitted". Returns the cleaned value and any
 * errors — callers persist `value` (e.g. into the entity's `custom_fields` or
 * `metadata` jsonb) only when `ok`.
 */
export type NamespacedCustomFieldValues = Record<string, Record<string, unknown>>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function validateCustomFields(
  registry: CustomFieldRegistry,
  entity: string,
  input: NamespacedCustomFieldValues | null | undefined,
): CustomFieldValidationResult {
  const provided = input ?? {}
  const fields = registry.forEntity(entity)
  const known = new Set(fields.map((f) => `${f.namespace}.${f.key}`))
  const errors: CustomFieldError[] = []
  const value: NamespacedCustomFieldValues = {}

  for (const [namespace, fieldsForNamespace] of Object.entries(provided)) {
    if (!isRecord(fieldsForNamespace)) {
      errors.push({ namespace, key: "", message: "must be an object keyed by custom-field key" })
      continue
    }
    for (const key of Object.keys(fieldsForNamespace)) {
      if (!known.has(`${namespace}.${key}`)) {
        errors.push({ namespace, key, message: `unknown custom field for "${entity}"` })
      }
    }
  }

  for (const def of fields) {
    const raw = provided[def.namespace]?.[def.key]
    const absent = raw === null || raw === undefined
    if (absent) {
      if (def.required) {
        errors.push({ namespace: def.namespace, key: def.key, message: "is required" })
      }
      continue
    }
    const typeError = checkType(def, raw)
    if (typeError) {
      errors.push({ namespace: def.namespace, key: def.key, message: typeError })
      continue
    }
    const namespaceValues = value[def.namespace] ?? {}
    namespaceValues[def.key] = raw
    value[def.namespace] = namespaceValues
  }

  return { ok: errors.length === 0, value, errors }
}

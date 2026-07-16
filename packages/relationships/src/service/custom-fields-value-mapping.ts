/**
 * Mapping between the EAV value shape (typed columns) and the unified single
 * jsonb value stored in an entity's `custom_fields` column. Each EAV
 * `custom_field_type` maps to exactly ONE representation, so
 * input → jsonb → response round-trips faithfully, and the representation
 * matches what the registry validates on the entity-update path. See the
 * custom-fields unification ADR.
 */

/** Entity types whose table carries a `custom_fields` column. */
const ENTITY_TABLE: Record<string, string> = {
  person: "people",
  organization: "organizations",
  activity: "activities",
  booking: "bookings",
  quote: "quotes",
}

/** The physical table for an entity type, or `null` if it has no column. */
export function entityTableName(entityType: string): string | null {
  return ENTITY_TABLE[entityType] ?? null
}

/**
 * A custom-field value's stable id in the unified model — values no longer have
 * their own rows, so the id encodes everything `list`/`delete` need.
 */
export function syntheticValueId(
  entityType: string,
  entityId: string,
  definitionId: string,
): string {
  return `${entityType}::${entityId}::${definitionId}`
}

export function parseSyntheticValueId(
  id: string,
): { entityType: string; entityId: string; definitionId: string } | null {
  const parts = id.split("::")
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) {
    return null
  }
  return {
    entityType: parts[0] as string,
    entityId: parts[1] as string,
    definitionId: parts[2] as string,
  }
}

/** The typed value columns the value API exchanges. */
export interface TypedValueColumns {
  textValue: string | null
  numberValue: number | null
  dateValue: string | null
  booleanValue: boolean | null
  monetaryValueCents: number | null
  currencyCode: string | null
  jsonValue: Record<string, unknown> | string[] | null
}

const EMPTY_TYPED: TypedValueColumns = {
  textValue: null,
  numberValue: null,
  dateValue: null,
  booleanValue: null,
  monetaryValueCents: null,
  currencyCode: null,
  jsonValue: null,
}

/** Collapse the typed input columns into the single jsonb value for `fieldType`. */
export function jsonbValueFromTyped(fieldType: string, input: Partial<TypedValueColumns>): unknown {
  switch (fieldType) {
    case "double":
      return input.numberValue ?? null
    case "date":
      return input.dateValue ?? null
    case "boolean":
      return input.booleanValue ?? null
    case "monetary":
      return input.monetaryValueCents == null
        ? null
        : { amountCents: input.monetaryValueCents, currency: input.currencyCode ?? null }
    case "set":
    case "json":
    case "address":
      return input.jsonValue ?? null
    default:
      // varchar | text | enum | phone
      return input.textValue ?? null
  }
}

/** Expand a single jsonb value back into the typed columns for `fieldType`. */
export function typedFromJsonbValue(fieldType: string, value: unknown): TypedValueColumns {
  switch (fieldType) {
    case "double":
      return { ...EMPTY_TYPED, numberValue: value as number }
    case "date":
      return { ...EMPTY_TYPED, dateValue: value as string }
    case "boolean":
      return { ...EMPTY_TYPED, booleanValue: value as boolean }
    case "monetary": {
      const money = (value ?? {}) as { amountCents?: number; currency?: string }
      return {
        ...EMPTY_TYPED,
        monetaryValueCents: money.amountCents ?? null,
        currencyCode: money.currency ?? null,
      }
    }
    case "set":
    case "json":
    case "address":
      return { ...EMPTY_TYPED, jsonValue: value as Record<string, unknown> | string[] | null }
    default:
      // varchar | text | enum | phone
      return { ...EMPTY_TYPED, textValue: value as string }
  }
}

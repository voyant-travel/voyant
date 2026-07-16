import type { UpsertCustomFieldValueInput } from "./value-contracts.js"

/** A custom-field value is addressed by entity, physical namespace, and definition. */
export function syntheticCustomFieldValueId(
  entityType: string,
  entityId: string,
  namespace: string,
  definitionId: string,
): string {
  return `${entityType}::${entityId}::${namespace}::${definitionId}`
}

export function parseSyntheticCustomFieldValueId(
  id: string,
): { entityType: string; entityId: string; namespace: string; definitionId: string } | null {
  const parts = id.split("::")
  if (parts.length !== 4 || parts.some((part) => part.length === 0)) return null
  return {
    entityType: parts[0] as string,
    entityId: parts[1] as string,
    namespace: parts[2] as string,
    definitionId: parts[3] as string,
  }
}

export interface TypedCustomFieldValueColumns {
  textValue: string | null
  numberValue: number | null
  dateValue: string | null
  booleanValue: boolean | null
  monetaryValueCents: number | null
  currencyCode: string | null
  jsonValue: Record<string, unknown> | string[] | null
}

const emptyTypedValue: TypedCustomFieldValueColumns = {
  textValue: null,
  numberValue: null,
  dateValue: null,
  booleanValue: null,
  monetaryValueCents: null,
  currencyCode: null,
  jsonValue: null,
}

export function jsonbValueFromTypedCustomFieldValue(
  fieldType: string,
  input: Partial<UpsertCustomFieldValueInput>,
): unknown {
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
      return input.textValue ?? null
  }
}

export function typedCustomFieldValueFromJsonb(
  fieldType: string,
  value: unknown,
): TypedCustomFieldValueColumns {
  switch (fieldType) {
    case "double":
      return { ...emptyTypedValue, numberValue: value as number }
    case "date":
      return { ...emptyTypedValue, dateValue: value as string }
    case "boolean":
      return { ...emptyTypedValue, booleanValue: value as boolean }
    case "monetary": {
      const money = (value ?? {}) as { amountCents?: number; currency?: string }
      return {
        ...emptyTypedValue,
        monetaryValueCents: money.amountCents ?? null,
        currencyCode: money.currency ?? null,
      }
    }
    case "set":
    case "json":
    case "address":
      return { ...emptyTypedValue, jsonValue: value as Record<string, unknown> | string[] | null }
    default:
      return { ...emptyTypedValue, textValue: value as string }
  }
}

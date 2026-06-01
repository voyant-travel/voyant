import { TypeID, typeid } from "typeid-js"

import { PREFIXES, type PrefixKey, type PrefixValue } from "./typeid-prefixes.js"

/**
 * Register a custom TypeID prefix for extension tables.
 */
export function registerPrefix(tableName: string, prefix: string): void {
  if ((PREFIXES as Record<string, string>)[tableName]) {
    throw new Error(`Prefix already registered for table "${tableName}"`)
  }

  if (Object.values(PREFIXES).includes(prefix as PrefixValue)) {
    throw new Error(`Prefix "${prefix}" is already in use`)
  }

  ;(PREFIXES as Record<string, string>)[tableName] = prefix
}

/**
 * Generates a new TypeID with the correct prefix.
 */
export function newId(prefix: PrefixKey): string {
  return typeid(PREFIXES[prefix]).toString()
}

/**
 * Generates a new TypeID using a raw prefix string.
 */
export function newIdFromPrefix(prefix: string): string {
  return typeid(prefix).toString()
}

/**
 * Decodes a TypeID string to extract its components.
 */
export function decodeId<T extends string>(id: string, expectedPrefix: T): TypeID<T>
export function decodeId(id: string): TypeID<string>
export function decodeId<T extends string>(
  id: string,
  expectedPrefix?: T,
): TypeID<T> | TypeID<string> {
  if (expectedPrefix) {
    return TypeID.fromString(id, expectedPrefix)
  }

  return TypeID.fromString(id)
}

/**
 * Validates that a string is a valid TypeID with the expected prefix.
 */
export function isValidId(id: string, expectedPrefix: PrefixKey | PrefixValue): boolean {
  try {
    const decoded = decodeId(id)
    const prefix =
      expectedPrefix in PREFIXES ? PREFIXES[expectedPrefix as PrefixKey] : expectedPrefix
    return decoded.getType() === prefix
  } catch {
    return false
  }
}

/**
 * Extracts the prefix from a TypeID string.
 */
export function getPrefix(id: string): string {
  return decodeId(id).getType()
}

/**
 * Extracts the timestamp from a TypeID.
 */
export function getTimestamp(id: string): Date {
  const uuid = decodeId(id).toUUID()
  const hex = uuid.replace(/-/g, "").slice(0, 12)
  return new Date(parseInt(hex, 16))
}

/**
 * Compares two TypeIDs chronologically.
 */
export function compareIds(a: string, b: string): number {
  return a.localeCompare(b)
}

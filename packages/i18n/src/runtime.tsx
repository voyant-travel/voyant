"use client"

import { createContext, type ReactNode, useContext, useMemo } from "react"

import { canonicalizeLocale, localeHierarchy } from "./locale.js"
import {
  formatIcuMessage,
  isCompatibleIcuOverride,
  type MessageFormatOptions,
  type MessageValues,
} from "./message-format.js"

export type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T

export type LocaleMessageDefinitions<T extends Record<string, unknown>> = Record<string, T>

export interface LocaleMessageOverrides<T extends Record<string, unknown>> {
  shared?: DeepPartial<T> | null
  locales?: Partial<Record<string, DeepPartial<T>>> | null
}

export type LocaleMessageSchema<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly LocaleMessageSchema<U>[]
    : T extends Array<infer U>
      ? Array<LocaleMessageSchema<U>>
      : T extends object
        ? { [K in keyof T]: LocaleMessageSchema<T[K]> }
        : T

const UNSAFE_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function getLocaleMessageOverridesFromUiPrefs<T extends Record<string, unknown>>(
  uiPrefs: unknown,
  definitions?: LocaleMessageDefinitions<T>,
): LocaleMessageOverrides<T> | undefined {
  if (!isPlainObject(uiPrefs)) {
    return undefined
  }

  const i18n = uiPrefs.i18n
  if (!isPlainObject(i18n)) {
    return undefined
  }

  if (!isPlainObject(i18n.admin)) return undefined

  const schema = definitions ? Object.values(definitions)[0] : undefined
  const result: LocaleMessageOverrides<T> = {}
  const shared = sanitizeOverrideNode(schema, i18n.admin.shared)
  if (shared && isPlainObject(shared) && Object.keys(shared).length > 0) {
    result.shared = shared as DeepPartial<T>
  }

  if (isPlainObject(i18n.admin.locales)) {
    const locales: Record<string, DeepPartial<T>> = {}
    for (const [locale, override] of Object.entries(i18n.admin.locales)) {
      const sanitized = sanitizeOverrideNode(schema, override)
      if (sanitized && isPlainObject(sanitized) && Object.keys(sanitized).length > 0) {
        locales[canonicalizeLocale(locale)] = sanitized as DeepPartial<T>
      }
    }
    if (Object.keys(locales).length > 0) result.locales = locales
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function sanitizeOverrideNode(schema: unknown, value: unknown): unknown {
  if (value === undefined || value === null) return undefined

  if (schema === undefined) {
    if (typeof value === "string") return value
    if (Array.isArray(value)) {
      const sanitized = value.map((item) => sanitizeOverrideNode(undefined, item))
      return sanitized.every((item) => item !== undefined) ? sanitized : undefined
    }
    if (!isPlainObject(value)) return undefined
    const result: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      if (UNSAFE_OBJECT_KEYS.has(key)) continue
      const sanitized = sanitizeOverrideNode(undefined, child)
      if (sanitized !== undefined) result[key] = sanitized
    }
    return Object.keys(result).length > 0 ? result : undefined
  }

  if (typeof schema === "string") {
    return typeof value === "string" && isCompatibleIcuOverride(schema, value) ? value : undefined
  }

  if (Array.isArray(schema)) {
    if (!Array.isArray(value)) return undefined
    if (schema.length === 0)
      return value.every((item) => typeof item === "string") ? value : undefined
    const sanitized = value
      .map((item) => sanitizeOverrideNode(schema[0], item))
      .filter((item) => item !== undefined)
    return sanitized.length === value.length ? sanitized : undefined
  }

  if (!isPlainObject(schema) || !isPlainObject(value)) return undefined

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_OBJECT_KEYS.has(key) || !(key in schema)) continue
    const sanitized = sanitizeOverrideNode(schema[key], child)
    if (sanitized !== undefined) result[key] = sanitized
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function mergeDeep<T>(base: T, override?: DeepPartial<T> | null): T {
  if (override === undefined || override === null) {
    return base
  }

  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override as T
  }

  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined || UNSAFE_OBJECT_KEYS.has(key)) {
      continue
    }

    const existing = result[key]
    result[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? mergeDeep(existing, value)
        : (value as unknown)
  }

  return result as T
}

function sanitizeOverrides<T extends Record<string, unknown>>(
  schema: T,
  overrides: LocaleMessageOverrides<T> | null | undefined,
): LocaleMessageOverrides<T> | undefined {
  if (!overrides) return undefined

  const result: LocaleMessageOverrides<T> = {}
  const shared = sanitizeOverrideNode(schema, overrides.shared)
  if (shared && isPlainObject(shared) && Object.keys(shared).length > 0) {
    result.shared = shared as DeepPartial<T>
  }

  if (isPlainObject(overrides.locales)) {
    const locales: Record<string, DeepPartial<T>> = {}
    for (const [locale, override] of Object.entries(overrides.locales)) {
      const sanitized = sanitizeOverrideNode(schema, override)
      if (sanitized && isPlainObject(sanitized) && Object.keys(sanitized).length > 0) {
        locales[canonicalizeLocale(locale)] = sanitized as DeepPartial<T>
      }
    }
    if (Object.keys(locales).length > 0) result.locales = locales
  }

  return Object.keys(result).length > 0 ? result : undefined
}

function findLocaleEntry<T>(record: Partial<Record<string, T>>, locale: string): T | undefined {
  const canonical = canonicalizeLocale(locale).toLowerCase()
  return Object.entries(record).find(
    ([key]) => canonicalizeLocale(key).toLowerCase() === canonical,
  )?.[1]
}

function resolveDefinitionKeys<T extends Record<string, unknown>>(
  locale: string | null | undefined,
  definitions: LocaleMessageDefinitions<T>,
): string[] {
  const keys = Object.keys(definitions)
  const matches = localeHierarchy(locale)
    .map((candidate) =>
      keys.find((key) => canonicalizeLocale(key).toLowerCase() === candidate.toLowerCase()),
    )
    .filter((key): key is string => Boolean(key))
  return [...new Set(matches)]
}

export function resolveLocaleMessages<T extends Record<string, unknown>>({
  locale,
  fallbackLocale,
  definitions,
  overrides,
}: {
  locale: string | null | undefined
  fallbackLocale: string
  definitions: LocaleMessageDefinitions<T>
  overrides?: LocaleMessageOverrides<T> | null
}): T {
  const definitionKeys = Object.keys(definitions)
  if (definitionKeys.length === 0) {
    throw new Error("resolveLocaleMessages requires at least one locale definition")
  }

  const fallbackKey =
    resolveDefinitionKeys(fallbackLocale, definitions).at(-1) ?? definitionKeys[0]!
  const sanitizedOverrides = sanitizeOverrides(definitions[fallbackKey]!, overrides)
  const localeKeys = resolveDefinitionKeys(locale, definitions)
  const selectedKeys = localeKeys.length > 0 ? localeKeys : [fallbackKey]

  let resolved: T = definitions[fallbackKey]!
  for (const key of selectedKeys) {
    if (key !== fallbackKey) resolved = mergeDeep(resolved, definitions[key] as DeepPartial<T>)
  }
  resolved = mergeDeep(resolved, sanitizedOverrides?.shared)

  const overrideLocales =
    localeKeys.length > 0 ? localeHierarchy(locale) : localeHierarchy(fallbackKey)
  for (const candidate of overrideLocales) {
    resolved = mergeDeep(resolved, findLocaleEntry(sanitizedOverrides?.locales ?? {}, candidate))
  }

  return resolved
}

export function useResolvedLocaleMessages<T extends Record<string, unknown>>({
  locale,
  fallbackLocale,
  definitions,
  overrides,
}: {
  locale: string | null | undefined
  fallbackLocale: string
  definitions: LocaleMessageDefinitions<T>
  overrides?: LocaleMessageOverrides<T> | null
}): T {
  return useMemo(
    () =>
      resolveLocaleMessages({
        locale,
        fallbackLocale,
        definitions,
        overrides,
      }),
    [definitions, fallbackLocale, locale, overrides],
  )
}

export function composeLocaleMessageDefinitions<T extends Record<string, unknown>>(
  ...definitions: Array<Partial<Record<string, DeepPartial<T>>>>
): LocaleMessageDefinitions<T> {
  const result: Record<string, unknown> = {}

  for (const definition of definitions) {
    for (const [locale, messages] of Object.entries(definition)) {
      const existing = result[locale]
      result[locale] =
        isPlainObject(existing) && isPlainObject(messages)
          ? mergeDeep(existing, messages)
          : messages
    }
  }

  return result as LocaleMessageDefinitions<T>
}

export function formatMessage(
  template: string,
  values: MessageValues,
  options?: MessageFormatOptions,
): string {
  return formatIcuMessage(template, values, options)
}

const MessagesContext = createContext<Record<string, unknown> | undefined>(undefined)

export function MessagesProvider<T extends Record<string, unknown>>({
  children,
  messages,
}: {
  children: ReactNode
  messages: T
}) {
  return <MessagesContext.Provider value={messages}>{children}</MessagesContext.Provider>
}

export function useMessages<T extends Record<string, unknown>>(): T {
  const context = useContext(MessagesContext)
  if (!context) {
    throw new Error("useMessages must be used within <MessagesProvider>")
  }

  return context as T
}

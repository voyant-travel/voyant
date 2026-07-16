import IntlMessageFormat from "intl-messageformat"

import { canonicalizeLocale, canonicalizeTimeZone } from "./locale.js"

export type MessageValue = string | number | bigint | boolean | Date | null | undefined
export type MessageValues = Record<string, MessageValue>

export interface MessageFormatOptions {
  locale?: string | null
  timeZone?: string | null
}

const MAX_COMPILED_MESSAGES = 1_000
const compiledMessages = new Map<string, IntlMessageFormat>()
const ICU_ARGUMENT_ELEMENT_TYPES = new Set([1, 2, 3, 4, 5, 6])

type MessageAstElement = {
  type: number
  value?: string
  options?: Record<string, { value: MessageAstElement[] }>
  children?: MessageAstElement[]
}

function rememberCompiledMessage(key: string, formatter: IntlMessageFormat) {
  if (compiledMessages.size >= MAX_COMPILED_MESSAGES) {
    const oldestKey = compiledMessages.keys().next().value
    if (oldestKey !== undefined) compiledMessages.delete(oldestKey)
  }
  compiledMessages.set(key, formatter)
}

function getCompiledMessage(template: string, locale: string, timeZone: string | null) {
  const key = `${locale}\u0000${timeZone ?? ""}\u0000${template}`
  const cached = compiledMessages.get(key)
  if (cached) {
    compiledMessages.delete(key)
    compiledMessages.set(key, cached)
    return cached
  }

  const formatter = new IntlMessageFormat(template, locale, undefined, {
    ignoreTag: true,
    ...(timeZone
      ? {
          formatters: {
            getNumberFormat: (locales, options) =>
              new Intl.NumberFormat(locales, options as Intl.NumberFormatOptions),
            getDateTimeFormat: (locales, options) =>
              new Intl.DateTimeFormat(locales, { timeZone, ...options }),
            getPluralRules: (locales, options) => new Intl.PluralRules(locales, options),
          },
        }
      : {}),
  })
  rememberCompiledMessage(key, formatter)
  return formatter
}

function isJson(value: string): boolean {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function messageArgumentSignature(template: string): string[] {
  const trimmed = template.trim()
  if (trimmed.includes("{{") && trimmed.includes("}}")) return []
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isJson(trimmed)) return []

  const formatter = new IntlMessageFormat(template, "en", undefined, { ignoreTag: true })
  const argumentsByName = new Map<string, Set<number>>()

  function visit(elements: MessageAstElement[]) {
    for (const element of elements) {
      if (ICU_ARGUMENT_ELEMENT_TYPES.has(element.type) && typeof element.value === "string") {
        const types = argumentsByName.get(element.value) ?? new Set<number>()
        types.add(element.type)
        argumentsByName.set(element.value, types)
      }
      for (const option of Object.values(element.options ?? {})) visit(option.value)
      if (element.children) visit(element.children)
    }
  }

  visit(formatter.getAst() as MessageAstElement[])
  return [...argumentsByName.entries()]
    .map(([name, types]) => `${name}:${[...types].sort().join("|")}`)
    .sort()
}

export function isCompatibleIcuOverride(schema: string, candidate: string): boolean {
  try {
    return (
      JSON.stringify(messageArgumentSignature(schema)) ===
      JSON.stringify(messageArgumentSignature(candidate))
    )
  } catch {
    return false
  }
}

export function formatIcuMessage(
  template: string,
  values: MessageValues,
  options: MessageFormatOptions = {},
): string {
  const locale = canonicalizeLocale(options.locale)
  const timeZone = canonicalizeTimeZone(options.timeZone)
  const result = getCompiledMessage(template, locale, timeZone).format(values)

  if (Array.isArray(result)) return result.join("")
  return String(result)
}

import { parse, TYPE } from "@formatjs/icu-messageformat-parser"

const DEFINITION_EXPORT_NAME = /(MessageDefinitions|Messages)$/

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function messageArguments(message) {
  const argumentsByName = new Map()

  function remember(name, type) {
    const types = argumentsByName.get(name) ?? new Set()
    types.add(type)
    argumentsByName.set(name, types)
  }

  function visit(elements) {
    for (const element of elements) {
      if (
        element.type === TYPE.argument ||
        element.type === TYPE.number ||
        element.type === TYPE.date ||
        element.type === TYPE.time ||
        element.type === TYPE.select ||
        element.type === TYPE.plural
      ) {
        remember(element.value, TYPE[element.type])
      }

      if (element.type === TYPE.select || element.type === TYPE.plural) {
        for (const option of Object.values(element.options)) visit(option.value)
      } else if (element.type === TYPE.tag) {
        visit(element.children)
      }
    }
  }

  visit(parse(message, { ignoreTag: true, requiresOtherClause: true }))
  return [...argumentsByName.entries()]
    .map(([name, types]) => `${name}:${[...types].sort().join("|")}`)
    .sort()
}

function validateMessage(moduleName, locale, value, path, errors) {
  const trimmed = value.trim()
  if (trimmed.includes("{{") && trimmed.includes("}}")) return []
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isJson(trimmed)) return []

  try {
    return messageArguments(value)
  } catch (error) {
    errors.push(
      `${moduleName}:${locale} invalid ICU message at ${path.join(".") || "<root>"}: ${error instanceof Error ? error.message : String(error)}`,
    )
    return null
  }
}

function isJson(value) {
  try {
    JSON.parse(value)
    return true
  } catch {
    return false
  }
}

function compareShapes(moduleName, locale, expected, actual, path, errors) {
  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      errors.push(`${moduleName}:${locale} missing object at ${path.join(".") || "<root>"}`)
      return
    }

    for (const key of Object.keys(expected)) {
      if (!(key in actual)) {
        errors.push(`${moduleName}:${locale} missing key ${[...path, key].join(".")}`)
        continue
      }

      compareShapes(moduleName, locale, expected[key], actual[key], [...path, key], errors)
    }

    for (const key of Object.keys(actual)) {
      if (!(key in expected)) {
        errors.push(`${moduleName}:${locale} extra key ${[...path, key].join(".")}`)
      }
    }

    return
  }

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      errors.push(`${moduleName}:${locale} expected array at ${path.join(".") || "<root>"}`)
      return
    }
    if (expected.length !== actual.length) {
      errors.push(
        `${moduleName}:${locale} array length mismatch at ${path.join(".") || "<root>"}: expected ${expected.length}, received ${actual.length}`,
      )
      return
    }
    for (const [index, item] of expected.entries()) {
      compareShapes(moduleName, locale, item, actual[index], [...path, String(index)], errors)
    }
    return
  }

  if (typeof expected !== typeof actual) {
    errors.push(
      `${moduleName}:${locale} type mismatch at ${path.join(".") || "<root>"}: expected ${typeof expected}, received ${typeof actual}`,
    )
    return
  }

  if (typeof expected === "string" && typeof actual === "string") {
    const expectedArguments =
      locale === "en"
        ? validateMessage(moduleName, "en", expected, path, errors)
        : messageArgumentsWithoutDiagnostics(expected)
    const actualArguments =
      locale === "en"
        ? expectedArguments
        : validateMessage(moduleName, locale, actual, path, errors)
    if (
      expectedArguments &&
      actualArguments &&
      JSON.stringify(expectedArguments) !== JSON.stringify(actualArguments)
    ) {
      errors.push(
        `${moduleName}:${locale} ICU argument mismatch at ${path.join(".") || "<root>"}: expected [${expectedArguments.join(", ")}], received [${actualArguments.join(", ")}]`,
      )
    }
  }
}

function messageArgumentsWithoutDiagnostics(value) {
  const trimmed = value.trim()
  if (trimmed.includes("{{") && trimmed.includes("}}")) return []
  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && isJson(trimmed)) return []
  try {
    return messageArguments(value)
  } catch {
    return null
  }
}

function isLocaleDefinitionsExport(value) {
  return isPlainObject(value) && "en" in value
}

export function collectLocaleDefinitionExports(source, moduleExports) {
  const entries = []

  for (const [exportName, value] of Object.entries(moduleExports)) {
    if (!DEFINITION_EXPORT_NAME.test(exportName) || !isLocaleDefinitionsExport(value)) {
      continue
    }

    entries.push({
      definitions: value,
      source: `${source}:${exportName}`,
    })
  }

  return entries
}

export function validateLocaleDefinitions(entries) {
  const errors = []

  for (const entry of entries) {
    const english = entry.definitions.en
    if (!english) {
      errors.push(`${entry.source} is missing required locale "en"`)
      continue
    }

    compareShapes(entry.source, "en", english, english, [], errors)

    for (const [locale, messages] of Object.entries(entry.definitions)) {
      if (locale === "en") {
        continue
      }

      compareShapes(entry.source, locale, english, messages, [], errors)
    }
  }

  return errors
}

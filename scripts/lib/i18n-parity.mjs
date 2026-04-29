const DEFINITION_EXPORT_NAME = /(MessageDefinitions|Messages)$/

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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

  if (Array.isArray(expected) && !Array.isArray(actual)) {
    errors.push(`${moduleName}:${locale} expected array at ${path.join(".") || "<root>"}`)
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

    for (const [locale, messages] of Object.entries(entry.definitions)) {
      if (locale === "en") {
        continue
      }

      compareShapes(entry.source, locale, english, messages, [], errors)
    }
  }

  return errors
}

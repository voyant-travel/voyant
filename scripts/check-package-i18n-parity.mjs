import { readdir } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { collectLocaleDefinitionExports, validateLocaleDefinitions } from "./lib/i18n-parity.mjs"

const rootDir = process.cwd()

async function collectPackageI18nEntries() {
  const entries = []
  const packagesDir = path.join(rootDir, "packages")

  async function walk(currentPath) {
    const directoryEntries = await readdir(currentPath, { withFileTypes: true })
    for (const entry of directoryEntries) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      const filePath = path.join(currentPath, entry.name)
      if (entry.isDirectory()) {
        await walk(filePath)
        continue
      }

      const parentName = path.basename(path.dirname(filePath))
      if (entry.name === "index.ts" && (parentName === "i18n" || parentName.endsWith("-i18n"))) {
        entries.push(filePath)
      } else if (/^i18n\.tsx?$/.test(entry.name)) {
        entries.push(filePath)
      }
    }
  }

  await walk(packagesDir)

  return [...new Set(entries)].sort()
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function findLocaleExport(moduleExports, source) {
  for (const value of Object.values(moduleExports)) {
    if (isPlainObject(value)) {
      return value
    }
  }

  throw new Error(`No locale message object export found in ${source}`)
}

async function collectLocaleFileDefinitions(entryFile) {
  const entryDir = path.dirname(entryFile)
  const localeFiles = (await readdir(entryDir))
    .filter((fileName) => /^[a-z]{2}(?:-[A-Z]{2})?\.ts$/.test(fileName))
    .sort()

  if (localeFiles.length === 0) {
    return null
  }

  const definitions = {}

  for (const localeFile of localeFiles) {
    const locale = path.basename(localeFile, ".ts")
    const filePath = path.join(entryDir, localeFile)
    const moduleExports = await import(pathToFileURL(filePath).href)
    definitions[locale] = findLocaleExport(moduleExports, path.relative(rootDir, filePath))
  }

  return {
    definitions,
    source: `${path.relative(rootDir, entryFile)}:localeFiles`,
  }
}

async function main() {
  const entryFiles = await collectPackageI18nEntries()
  if (entryFiles.length === 0) {
    throw new Error("No package i18n entrypoints were discovered; refusing to pass an empty check.")
  }
  const definitions = []

  for (const entryFile of entryFiles) {
    const moduleExports = await import(pathToFileURL(entryFile).href)
    const exportedDefinitions = collectLocaleDefinitionExports(
      path.relative(rootDir, entryFile),
      moduleExports,
    )

    if (exportedDefinitions.length > 0) {
      definitions.push(...exportedDefinitions)
      continue
    }

    const localeFileDefinitions = await collectLocaleFileDefinitions(entryFile)

    if (localeFileDefinitions) {
      definitions.push(localeFileDefinitions)
    }
  }

  if (definitions.length === 0) {
    throw new Error(
      `Discovered ${entryFiles.length} package i18n entrypoints but no locale definitions; refusing to pass an empty check.`,
    )
  }

  const errors = validateLocaleDefinitions(definitions)

  if (errors.length > 0) {
    console.error("package i18n locale parity check failed:\n")
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exit(1)
  }

  console.log(
    `package i18n locale parity check passed for ${definitions.length} definition sets across ${entryFiles.length} package entrypoints.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

import { access, readdir } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import { collectLocaleDefinitionExports, validateLocaleDefinitions } from "./lib/i18n-parity.mjs"

const rootDir = process.cwd()

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectPackageI18nEntries() {
  const entries = []

  const packagesDir = path.join(rootDir, "packages")
  const packageNames = await readdir(packagesDir)

  for (const packageName of packageNames) {
    if (packageName.endsWith("-ui")) {
      const filePath = path.join(packagesDir, packageName, "src", "i18n", "index.ts")
      if (await exists(filePath)) {
        entries.push(filePath)
      }
    }
  }

  const registryDir = path.join(packagesDir, "ui", "registry")
  const registryNames = await readdir(registryDir)

  for (const registryName of registryNames) {
    const filePath = path.join(registryDir, registryName, "i18n", "index.ts")
    if (await exists(filePath)) {
      entries.push(filePath)
    }
  }

  return entries.sort()
}

async function main() {
  const entryFiles = await collectPackageI18nEntries()
  const definitions = []

  for (const entryFile of entryFiles) {
    const moduleExports = await import(pathToFileURL(entryFile).href)
    definitions.push(
      ...collectLocaleDefinitionExports(path.relative(rootDir, entryFile), moduleExports),
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

#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

function option(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value) throw new Error(`${name} requires a value`)
  return value
}

const root = resolve(option("--root", "."))
const read = (path) => readFileSync(resolve(root, path), "utf8")
const failures = []

const hostPresentationPath = "packages/admin-host/src/admin-presentation.ts"
const hostPackagePath = "packages/admin-host/package.json"
const coreExtensionPath = "packages/admin-app/src/core-extension/index.tsx"
const customFieldsAdminPath = "packages/custom-fields-react/src/admin.tsx"

for (const path of [
  hostPresentationPath,
  hostPackagePath,
  coreExtensionPath,
  customFieldsAdminPath,
]) {
  if (!existsSync(resolve(root, path))) failures.push(`${path} is required`)
}

if (failures.length === 0) {
  const hostPresentation = read(hostPresentationPath)
  const hostPackage = JSON.parse(read(hostPackagePath))
  const coreExtension = read(coreExtensionPath)
  const customFieldsAdmin = read(customFieldsAdminPath)
  const firstPartyMessagePackages = [
    "@voyant-travel/auth-react",
    "@voyant-travel/commerce-react",
    "@voyant-travel/distribution-react",
    "@voyant-travel/finance-react",
    "@voyant-travel/inventory-react",
    "@voyant-travel/relationships-react",
    "@voyant-travel/custom-fields-react",
  ]

  for (const token of ["coreRouteMessagesProviders", "loadProvider", "withCoreRouteMessages"]) {
    if (hostPresentation.includes(token)) {
      failures.push(`${hostPresentationPath} retains compatibility registry token ${token}`)
    }
  }
  for (const packageName of firstPartyMessagePackages) {
    if (hostPresentation.includes(packageName)) {
      failures.push(`${hostPresentationPath} must not import package copy from ${packageName}`)
    }
    for (const dependencyField of ["dependencies", "devDependencies", "peerDependencies"]) {
      if (hostPackage[dependencyField]?.[packageName]) {
        failures.push(`${hostPackagePath} retains ${dependencyField} entry ${packageName}`)
      }
    }
  }
  if (!hostPresentation.includes("defaultAdminHostNavMessages")) {
    failures.push(`${hostPresentationPath} must retain generic host fallback nav copy`)
  }

  const ownedProviderCounts = new Map([
    ['import("@voyant-travel/auth-react/i18n")', 2],
    ['import("@voyant-travel/distribution-react/i18n")', 1],
    ['import("@voyant-travel/finance-react/i18n")', 3],
    ['import("@voyant-travel/commerce-react/i18n")', 2],
    ['import("@voyant-travel/inventory-react/i18n")', 2],
  ])
  for (const [token, expected] of ownedProviderCounts) {
    const actual = coreExtension.split(token).length - 1
    if (actual !== expected) {
      failures.push(
        `${coreExtensionPath} must contain ${expected} route-owned loaders for ${token}`,
      )
    }
  }
  const routeProviderCount = coreExtension.split("routeMessagesProvider:").length - 1
  if (routeProviderCount < 9) {
    failures.push(`${coreExtensionPath} must retain at least 9 route-local message providers`)
  }
  if (!customFieldsAdmin.includes("routeMessagesProvider: customFieldsRouteMessagesProvider")) {
    failures.push(`${customFieldsAdminPath} must own custom-fields route copy metadata`)
  }
}

if (failures.length > 0) {
  console.error("Admin presentation fallback authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log("Admin presentation fallback authority: OK")

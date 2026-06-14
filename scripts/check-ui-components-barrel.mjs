import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const componentsDir = path.join(repoRoot, "packages/ui/src/components")
const barrelPath = path.join(componentsDir, "index.tsx")

const excludedFiles = new Set([
  "index.tsx",
  // These modules are intentionally direct-subpath imports only; see the
  // heavy-passthrough comments in packages/ui/src/components/index.tsx.
  "chart.tsx",
  "dashboard-widgets.tsx",
  "notification-deliveries-page.tsx",
  "notification-delivery-detail-dialog.tsx",
  "notification-reminder-rule-dialog.tsx",
  "notification-reminder-rules-page.tsx",
  "notification-reminder-runs-page.tsx",
  "notification-template-authoring-help.tsx",
  "notification-template-detail-page.tsx",
  "notification-template-dialog.tsx",
  "notification-templates-page.tsx",
  "phone-input.tsx",
  "rich-text-editor.tsx",
  // These are implementation splits re-exported through sidebar.tsx.
  "sidebar-core.tsx",
  "sidebar-menu.tsx",
])

const barrelSource = readFileSync(barrelPath, "utf8")
const componentEntries = readdirSync(componentsDir, { withFileTypes: true })
  .flatMap((entry) => {
    if (entry.isFile() && entry.name.endsWith(".tsx") && !excludedFiles.has(entry.name)) {
      return [
        {
          displayPath: entry.name,
          moduleSpecifier: `./${entry.name.replace(/\.tsx$/, ".js")}`,
        },
      ]
    }

    if (entry.isDirectory()) {
      const indexPath = path.join(componentsDir, entry.name, "index.ts")
      if (!existsSync(indexPath)) {
        return []
      }

      return [
        {
          displayPath: `${entry.name}/index.ts`,
          moduleSpecifier: `./${entry.name}/index.js`,
        },
      ]
    }

    return []
  })
  .sort((left, right) => left.displayPath.localeCompare(right.displayPath))

const missingExports = componentEntries.filter(({ moduleSpecifier }) => {
  const exportPattern = new RegExp(
    String.raw`export\s+\*\s+from\s+["']${moduleSpecifier.replaceAll("/", String.raw`\/`)}["']`,
  )

  return !exportPattern.test(barrelSource)
})

if (missingExports.length > 0) {
  console.error("@voyant-travel/ui components barrel is missing these component modules:")
  for (const { displayPath } of missingExports) {
    console.error(`  - packages/ui/src/components/${displayPath}`)
  }
  console.error("\nAdd export * entries to packages/ui/src/components/index.tsx.")
  process.exit(1)
}

console.log(`Verified ${componentEntries.length} @voyant-travel/ui component barrel exports.`)

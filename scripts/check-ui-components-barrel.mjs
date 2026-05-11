import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const componentsDir = path.join(repoRoot, "packages/ui/src/components")
const barrelPath = path.join(componentsDir, "index.tsx")

const excludedFiles = new Set([
  "index.tsx",
  // These are implementation splits re-exported through sidebar.tsx.
  "sidebar-core.tsx",
  "sidebar-menu.tsx",
])

const barrelSource = readFileSync(barrelPath, "utf8")
const componentFiles = readdirSync(componentsDir)
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => !excludedFiles.has(file))
  .sort()

const missingExports = componentFiles.filter((file) => {
  const moduleName = file.replace(/\.tsx$/, "")
  const exportPattern = new RegExp(
    String.raw`export\s+\*\s+from\s+["']\./${moduleName.replaceAll("-", String.raw`\-`)}\.js["']`,
  )

  return !exportPattern.test(barrelSource)
})

if (missingExports.length > 0) {
  console.error("@voyantjs/ui components barrel is missing these component modules:")
  for (const file of missingExports) {
    console.error(`  - packages/ui/src/components/${file}`)
  }
  console.error("\nAdd export * entries to packages/ui/src/components/index.tsx.")
  process.exit(1)
}

console.log(`Verified ${componentFiles.length} @voyantjs/ui component barrel exports.`)

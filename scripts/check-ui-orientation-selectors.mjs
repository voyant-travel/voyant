import { readdir, readFile } from "node:fs/promises"
import path from "node:path"

const repoRoot = process.cwd()
const componentsDir = path.join(repoRoot, "packages", "ui", "src", "components")
const disallowed = [
  "data-horizontal:",
  "data-vertical:",
  "group-data-horizontal/",
  "group-data-vertical/",
  "group-has-data-horizontal/",
  "group-has-data-vertical/",
]

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)))
      continue
    }

    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      files.push(entryPath)
    }
  }

  return files
}

const failures = []

for (const file of await collectFiles(componentsDir)) {
  const source = await readFile(file, "utf8")

  for (const token of disallowed) {
    if (source.includes(token)) {
      failures.push(`${path.relative(repoRoot, file)} uses ${token}`)
    }
  }
}

if (failures.length > 0) {
  console.error(
    [
      "UI package components must target data-orientation explicitly.",
      "Use data-[orientation=horizontal]: or group-data-[orientation=horizontal]/... so published builds do not depend on custom variant registration order.",
      "",
      ...failures,
    ].join("\n"),
  )
  process.exit(1)
}

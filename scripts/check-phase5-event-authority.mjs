import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  collectPhase5EventAuthority,
  inspectPhase5EventAuthority,
} from "./lib/phase5-event-authority.mjs"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot
const packagesRoot = path.join(repoRoot, "packages")
const failures = []
let checked = 0

async function findManifests(directory) {
  const manifests = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const child = path.join(directory, entry.name)
    if (entry.name === "src") manifests.push(path.join(child, "voyant.ts"))
    else manifests.push(...(await findManifests(child)))
  }
  return manifests
}

const manifests = []
for (const manifestPath of await findManifests(packagesRoot)) {
  try {
    const source = await readFile(manifestPath, "utf8")
    checked += 1
    manifests.push({
      source,
      location: path.relative(repoRoot, manifestPath).split(path.sep).join("/"),
    })
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

const eventCatalog = new Map(
  manifests.flatMap(({ source, location }) => [
    ...collectPhase5EventAuthority(source, location).events,
  ]),
)
for (const { source, location } of manifests) {
  failures.push(...inspectPhase5EventAuthority(source, location, eventCatalog))
}

if (failures.length > 0) {
  console.error("Phase 5 event authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Phase 5 event authority: OK (${checked} package manifests)`)

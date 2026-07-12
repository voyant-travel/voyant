import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  collectEventCalls,
  collectEventConstants,
  collectPhase5EventAuthority,
  inspectPhase5EventAuthority,
} from "./lib/phase5-event-authority.mjs"

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const rootArg = process.argv.indexOf("--root")
const repoRoot = rootArg >= 0 ? path.resolve(process.argv[rootArg + 1]) : defaultRoot
const packagesRoot = path.join(repoRoot, "packages")
const failures = []
let checked = 0
let sourceFiles = 0

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

async function findTypeScriptSources(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules" || entry.name === "tests") continue
    const child = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await findTypeScriptSources(child)))
    else if (
      entry.name.endsWith(".ts") &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts")
    ) {
      files.push(child)
    }
  }
  return files
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
const eventTypes = new Set(
  [...eventCatalog.values()].map((event) => event.eventType).filter(Boolean),
)
const subscriberTypes = new Set()
for (const { source, location } of manifests) {
  failures.push(...inspectPhase5EventAuthority(source, location, eventCatalog))
  for (const subscriber of collectPhase5EventAuthority(source, location).subscribers) {
    subscriberTypes.add(subscriber.eventType)
  }
}

const observedEmits = new Set()
const observedSubscriptions = new Set()
const unownedRuntimeSubscriptions = new Set()
const packageSources = []
const eventConstants = new Map()
const ambiguousEventConstants = new Set()
for (const sourcePath of await findTypeScriptSources(packagesRoot)) {
  const source = await readFile(sourcePath, "utf8")
  sourceFiles += 1
  packageSources.push(source)
  for (const [name, eventType] of collectEventConstants(source)) {
    const existing = eventConstants.get(name)
    if (existing && existing !== eventType) ambiguousEventConstants.add(name)
    else eventConstants.set(name, eventType)
  }
}
for (const name of ambiguousEventConstants) eventConstants.delete(name)
for (const source of packageSources) {
  for (const eventType of collectEventCalls(source, "emit", eventConstants)) {
    observedEmits.add(eventType)
  }
  for (const eventType of collectEventCalls(source, "subscribe", eventConstants)) {
    observedSubscriptions.add(eventType)
  }
}
for (const eventType of observedEmits) {
  if (!eventTypes.has(eventType)) {
    failures.push(`first-party emitter publishes undeclared event type "${eventType}"`)
  }
}
for (const eventType of observedSubscriptions) {
  if (!eventTypes.has(eventType)) {
    failures.push(`first-party runtime subscribes to undeclared event type "${eventType}"`)
  }
  if (!subscriberTypes.has(eventType)) {
    unownedRuntimeSubscriptions.add(eventType)
  }
}

if (failures.length > 0) {
  console.error("Phase 5 event authority check failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

const coveredEvents = [...eventTypes].filter(
  (eventType) => subscriberTypes.has(eventType) || observedSubscriptions.has(eventType),
).length
console.log(
  `Phase 5 event authority: OK (${eventCatalog.size} contracts, ${observedEmits.size} emitted types, ${subscriberTypes.size} subscriber types, ${coveredEvents} subscribed event types, ${unownedRuntimeSubscriptions.size} unowned runtime subscription types, ${checked} manifests, ${sourceFiles} source files)`,
)
if (unownedRuntimeSubscriptions.size > 0) {
  console.log(
    `Unowned runtime subscriptions: ${[...unownedRuntimeSubscriptions].sort().join(", ")}`,
  )
}

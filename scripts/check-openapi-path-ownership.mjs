#!/usr/bin/env node
/**
 * Every path in a generated OpenAPI document must be produced by its generator.
 *
 * `verify:openapi-drift` registers a FILE and regenerates it. Several generators
 * patch only the paths they own and carry the rest of the document through
 * untouched — deliberately, because one document can be fed by several route
 * modules. But only one generator is registered per file, so nothing regenerates
 * the remainder. The file is reported as matching its routes while most of it is
 * never compared to anything.
 *
 * Measured when this was written: of 1,125 paths across 82 documents, drift
 * reported 529 as verified and **392 actually were**. The 137-path gap is where
 * `finance`'s stale `nullable` keywords live, and it is the same shape as the
 * `media` document that was not valid OpenAPI and the endpoint missing from the
 * public shopping document for weeks (voyant#4798). `finance/admin/finance.json`
 * is the extreme: 3 of its 102 paths are generated.
 *
 * A path nobody generates is a passenger. It compiles, it publishes, it appears
 * in the API reference, and it can describe routes that no longer exist.
 *
 * ## How ownership is decided
 *
 * By asking the generator, not by trusting a declaration. The document's `paths`
 * are emptied, the generator runs, and whatever it puts back is what it owns.
 * A declaration would be one more thing that can drift from the code it
 * describes, which is the defect this file exists to catch.
 *
 * The artifact is restored from bytes held in memory, in a `finally` and again
 * on SIGINT/SIGTERM, because a run killed midway must not leave an emptied
 * document behind for `git add -A` to commit. Everything it touches is tracked,
 * so `git checkout -- packages` recovers regardless.
 */
import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const specsPath = path.join(root, "scripts/checks/openapi/generated-specs.json")
const baselinePath = path.join(root, "scripts/checks/openapi/path-ownership-baseline.json")

const { generators } = JSON.parse(readFileSync(specsPath, "utf8"))
const baseline = JSON.parse(readFileSync(baselinePath, "utf8")).unownedPaths

/**
 * Documents to probe: the OpenAPI artifacts, not the generated clients.
 *
 * Grouped by FILE, because a document may legitimately be registered under more
 * than one command — one artifact fed by two packages' route modules. Ownership
 * is then the union over its commands: a path is owned if any generator that
 * claims the file puts it back.
 *
 * Probing per (file, command) pair instead reported every path of a two-command
 * document as unowned, because emptying it and running one of the two returns
 * only that one's paths.
 */
const byFile = new Map()
for (const generator of generators) {
  if (generator.command.includes("generate:api-client")) continue
  for (const file of generator.files) {
    if (!file.endsWith(".json")) continue
    if (!byFile.has(file)) byFile.set(file, [])
    byFile.get(file).push(generator.command)
  }
}
const targets = [...byFile].map(([file, commands]) => ({ file, commands }))

/** Original bytes, so a killed run cannot leave an emptied document behind. */
const held = new Map()
const restoreAll = () => {
  for (const [file, bytes] of held) writeFileSync(path.join(root, file), bytes)
  held.clear()
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    restoreAll()
    process.exit(130)
  })
}

const pathsOf = (file) => Object.keys(JSON.parse(readFileSync(file, "utf8")).paths ?? {})

/** What the generator puts back into an emptied document is what it owns. */
function ownedPaths(file, command) {
  const absolute = path.join(root, file)
  const original = readFileSync(absolute)
  held.set(file, original)
  try {
    const document = JSON.parse(original.toString("utf8"))
    document.paths = {}
    writeFileSync(absolute, `${JSON.stringify(document, null, 2)}\n`)
    execSync(command, { cwd: root, stdio: "ignore" })
    return new Set(pathsOf(absolute))
  } finally {
    writeFileSync(absolute, original)
    held.delete(file)
  }
}

const violations = []
const improved = []
let ownedTotal = 0
let pathTotal = 0

try {
  for (const target of targets) {
    const declared = pathsOf(path.join(root, target.file))
    const owned = new Set()

    for (const command of target.commands) {
      const produced = ownedPaths(target.file, command)
      for (const route of produced) owned.add(route)

      // A command registered for a document it does not write. `verify:openapi-drift`
      // regenerates and diffs the files each command lists, so such a pair diffs a
      // file that command never touches — it always matches, and the document looks
      // checked by one more generator than actually checks it.
      if (produced.size === 0 && declared.length > 0) {
        violations.push(
          `generated-specs.json registers ${target.file} under \`${command}\`, which produces ` +
            `none of its paths. Drift diffs it there against a generator that never writes it.`,
        )
      }
    }

    const unowned = declared.filter((route) => !owned.has(route))

    pathTotal += declared.length
    ownedTotal += declared.length - unowned.length

    const allowed = baseline[target.file] ?? 0
    if (unowned.length > allowed) {
      violations.push(
        allowed === 0
          ? `${target.file} carries ${unowned.length} path(s) its generator does not produce, so ` +
              `nothing regenerates or compares them:\n` +
              unowned.map((route) => `      ${route}`).join("\n")
          : `${target.file} carries ${unowned.length} unowned path(s), above its baseline of ` +
              `${allowed}. The baseline may only shrink.`,
      )
    } else if (unowned.length < allowed) {
      improved.push(`${target.file}: ${allowed} -> ${unowned.length}`)
    }
  }
} finally {
  restoreAll()
}

for (const file of Object.keys(baseline)) {
  if (!targets.some((target) => target.file === file)) {
    violations.push(`path-ownership-baseline.json names ${file}, which no generator produces`)
  }
}

if (improved.length > 0) {
  console.error("OpenAPI path ownership improved. Lower the baseline in the same commit:\n")
  for (const line of improved) console.error(`  - ${line}`)
  process.exit(1)
}

if (violations.length > 0) {
  console.error("OpenAPI path ownership check failed.\n")
  for (const violation of violations) console.error(`  - ${violation}`)
  process.exit(1)
}

const unownedTotal = pathTotal - ownedTotal
console.log(
  `check-openapi-path-ownership: ${ownedTotal}/${pathTotal} paths in registered documents are ` +
    `produced by their generator` +
    (unownedTotal > 0 ? ` (${unownedTotal} carried through unchecked)` : ""),
)

#!/usr/bin/env node
/**
 * Measure the static ESM import closure for a built JavaScript entry.
 *
 * This walks only static `import` / `export ... from` edges and deliberately
 * stops at dynamic `import(...)` boundaries. It is meant for built Worker chunks
 * where startup cost tracks the files reachable from an entry before request
 * routing resolves lazy chunks.
 */
import { existsSync, readFileSync, statSync } from "node:fs"
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path"

const args = process.argv.slice(2)
const entryArg = args.shift()

if (!entryArg) {
  console.error("Usage: node scripts/measure-static-import-closure.mjs <entry.js> [--top N]")
  process.exit(1)
}

let topCount = 20
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === "--top") {
    topCount = Number(args[++i])
    if (!Number.isInteger(topCount) || topCount <= 0) {
      throw new Error("--top must be a positive integer")
    }
    continue
  }
  throw new Error(`Unknown argument: ${arg}`)
}

const entry = resolve(process.cwd(), entryArg)
const visited = new Set()
const edges = new Map()

walk(entry)

const files = [...visited].sort()
const rows = files.map((file) => ({ file, bytes: statSync(file).size }))
const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0)

console.log("Static import closure")
console.log(`entry: ${relative(process.cwd(), entry)}`)
console.log(`files: ${files.length}`)
console.log(`bytes: ${totalBytes} (${formatBytes(totalBytes)})`)
console.log("")
console.log("Largest files:")
for (const row of rows.sort((a, b) => b.bytes - a.bytes).slice(0, topCount)) {
  console.log(`${formatBytes(row.bytes).padStart(10)}  ${relative(process.cwd(), row.file)}`)
}

function walk(file) {
  const resolved = resolve(file)
  if (visited.has(resolved)) return
  if (!existsSync(resolved)) {
    throw new Error(`Import target does not exist: ${resolved}`)
  }
  visited.add(resolved)

  const source = readFileSync(resolved, "utf-8")
  const imports = staticImports(source)
  edges.set(resolved, imports)

  for (const specifier of imports) {
    if (!specifier.startsWith(".") && !specifier.startsWith("/")) continue
    const target = resolveImport(dirname(resolved), specifier)
    walk(target)
  }
}

function staticImports(source) {
  const imports = []
  const pattern =
    /(?:^|[;\n])\s*(?:import\s*(?:[^'"();]*?\s*from\s*)?|export\s*(?:[^'"();]*?\s*from\s*))["']([^"']+)["']/gs
  let match = pattern.exec(source)
  while (match) {
    imports.push(match[1])
    match = pattern.exec(source)
  }
  return imports
}

function resolveImport(fromDir, specifier) {
  const candidate = isAbsolute(specifier) ? specifier : join(fromDir, specifier)
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  if (!extname(candidate)) {
    for (const ext of [".js", ".mjs", ".cjs"]) {
      const withExt = `${candidate}${ext}`
      if (existsSync(withExt) && statSync(withExt).isFile()) return withExt
    }
  }
  throw new Error(`Could not resolve ${specifier} from ${fromDir}`)
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  return `${(kib / 1024).toFixed(2)} MiB`
}

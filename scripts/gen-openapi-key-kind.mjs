#!/usr/bin/env node
/**
 * Stamp `x-voyant-key-kind` onto every published operation in the committed
 * package OpenAPI documents (voyant#4625 §1).
 *
 * "Public API" reads as "safe to expose" to anyone skimming, which is exactly
 * the misreading that let a `vpk_` commit bookings. The published contract has
 * to say, per operation, which key kind reaches it — and it has to say it from
 * the same declaration the runtime enforces, so a document can never promise a
 * reach the deployment refuses.
 *
 * Idempotent: run it after regenerating any spec. `verify:openapi-key-kind`
 * fails when the tree drifts from what this would write.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import {
  KEY_KIND_EXTENSION,
  keyKindForPath,
  publishedOperations,
  readApiBundles,
} from "./lib/openapi-key-kind.mjs"
import { openApiDocumentFiles, requireDeploymentGraph } from "./lib/openapi-key-kind-tree.mjs"

// Resolved from this file, not the cwd: package-level `generate:openapi`
// scripts invoke it from their own directory, where the tracked-tree scan
// would find no repository and refuse to run.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const bundles = readApiBundles(requireDeploymentGraph(root))

let changed = 0
let stamped = 0
const rewritten = []
for (const file of openApiDocumentFiles(root)) {
  const absolute = path.join(root, file)
  const source = readFileSync(absolute, "utf8")
  const document = JSON.parse(source)
  let touched = false
  for (const { path: routePath, operation } of publishedOperations(document)) {
    const kind = routePath.startsWith("/v1/admin/") ? "secret" : keyKindForPath(bundles, routePath)
    stamped += 1
    if (operation[KEY_KIND_EXTENSION] === kind) continue
    operation[KEY_KIND_EXTENSION] = kind
    touched = true
  }
  if (!touched) continue
  writeFileSync(absolute, `${JSON.stringify(document, null, 2)}\n`)
  rewritten.push(absolute)
  changed += 1
  console.log(`stamped ${file}`)
}

// `JSON.stringify` expands every short array; the committed specs are
// biome-formatted. Reformat what was rewritten so the diff is the stamp and
// nothing else — a generator whose output needs a follow-up command is one
// people forget to finish.
if (rewritten.length > 0) {
  execFileSync("npx", ["biome", "format", "--write", ...rewritten], { stdio: "inherit" })
}

console.log(
  `openapi key kind: ${stamped} operations across ${openApiDocumentFiles(root).length} documents (${changed} rewritten)`,
)

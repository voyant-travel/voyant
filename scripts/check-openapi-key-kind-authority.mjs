#!/usr/bin/env node
/**
 * The PK/SK capability line is declared, complete, and published (voyant#4625 §1).
 *
 * Three things have to hold together, and each one alone is worth nothing:
 *
 *  1. **Every public API bundle states a posture.** A bundle that declares
 *     neither `publishable` nor `guardedIntake` is secret-key-only — which is
 *     the right default, and indistinguishable from nobody having looked at it.
 *     So a secret-only public bundle must be named in
 *     `scripts/checks/openapi/secret-only-public-bundles.json` with a reason.
 *     That turns "unclassified" into a reviewable decision instead of silence.
 *
 *  2. **Every published operation carries `x-voyant-key-kind`.** "Public API"
 *     reads as "safe to expose" to anyone skimming; the document has to say per
 *     operation which key kind reaches it.
 *
 *  3. **The stamp matches the graph.** Derived from the same declarations the
 *     runtime middleware reads, so a document can never promise a reach the
 *     deployment refuses. Hand-editing a spec fails here rather than shipping a
 *     contract the runtime 403s.
 *
 * (1) without (2) documents nothing; (2) without (3) documents a guess.
 */
import { readFileSync } from "node:fs"
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
const allowlist = JSON.parse(
  readFileSync(path.join(root, "scripts/checks/openapi/secret-only-public-bundles.json"), "utf8"),
)
const secretOnly = new Map(Object.entries(allowlist.bundles ?? {}))

const failures = []

// (1) Every public bundle states a posture — or is named as secret-only.
const publicBundles = bundles.filter((bundle) => bundle.surface === "public")
for (const bundle of publicBundles) {
  const declared = bundle.publishable !== undefined || bundle.guardedIntake !== undefined
  const listed = secretOnly.has(bundle.apiId)
  if (declared && listed) {
    failures.push(
      `${bundle.apiId} declares a publishable posture AND is listed as secret-only; remove the allowlist entry.`,
    )
  } else if (!declared && !listed) {
    failures.push(
      `${bundle.apiId} (${bundle.mount}) declares no key-kind posture. Add \`publishable\`/\`guardedIntake\` to its manifest, or record it in scripts/checks/openapi/secret-only-public-bundles.json with a reason.`,
    )
  }
}

// An exemption that outlives its reason quietly re-opens the gap.
for (const apiId of secretOnly.keys()) {
  const bundle = publicBundles.find((candidate) => candidate.apiId === apiId)
  if (!bundle) {
    failures.push(`secret-only-public-bundles.json names "${apiId}", which is not a public bundle.`)
    continue
  }
  if (!secretOnly.get(apiId)?.trim()) {
    failures.push(`secret-only-public-bundles.json entry "${apiId}" has no reason.`)
  }
}

// (2) + (3) Every published operation is stamped, and stamped correctly.
const documents = openApiDocumentFiles(root)
let operationCount = 0
let publishableCount = 0
for (const file of documents) {
  const document = JSON.parse(readFileSync(path.join(root, file), "utf8"))
  for (const { path: routePath, method, operation } of publishedOperations(document)) {
    operationCount += 1
    const expected = routePath.startsWith("/v1/admin/")
      ? "secret"
      : keyKindForPath(bundles, routePath)
    if (expected === "publishable") publishableCount += 1
    const actual = operation[KEY_KIND_EXTENSION]
    if (actual === undefined) {
      failures.push(
        `${file}: ${method.toUpperCase()} ${routePath} has no ${KEY_KIND_EXTENSION}. Run \`pnpm generate:openapi-key-kind\`.`,
      )
    } else if (actual !== expected) {
      failures.push(
        `${file}: ${method.toUpperCase()} ${routePath} is stamped "${actual}" but the graph says "${expected}". Run \`pnpm generate:openapi-key-kind\`.`,
      )
    }
  }
}

// A checker that finds nothing passes for free. Both halves must have run.
if (documents.length === 0) failures.push("no committed OpenAPI documents were found.")
if (publicBundles.length === 0) failures.push("the graph selected no public API bundles.")
if (operationCount === 0) failures.push("no published operations were inspected.")

if (failures.length > 0) {
  console.error("OpenAPI key-kind authority failed:\n")
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(
  `OpenAPI key-kind authority: OK (${publicBundles.length} public bundles, ${operationCount} operations, ${publishableCount} publishable)`,
)

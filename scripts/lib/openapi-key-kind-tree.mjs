/**
 * Tree access shared by the key-kind generator and its checker.
 *
 * Documents are read from the TRACKED tree, not from whatever is on disk: a
 * git worktree parked under the repository root, or a leftover directory from a
 * deleted package, is not this tree's source and does not exist in CI's
 * checkout. Resolving another checkout's specs would validate those and report
 * success while this tree was broken (voyant#4281).
 */
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { trackedFilesIn } from "./tracked-files.mjs"

const OPENAPI_PATTERN = /^packages\/[^/]+\/openapi\/[^/]+\/[^/]+\.json$/

/** Committed package-owned OpenAPI documents, repo-relative and sorted. */
export function openApiDocumentFiles(root) {
  const tracked = trackedFilesIn(root)
  if (!tracked) {
    throw new Error(
      "openapi key kind: refusing to scan an untracked tree; run this from the repository root.",
    )
  }
  return tracked.filter((file) => OPENAPI_PATTERN.test(file)).sort()
}

const GRAPH_PATH = "apps/operator/.voyant/deployment-graph.generated.json"

/**
 * The resolved deployment graph. Generated rather than committed, so a clean
 * checkout has to build it first — failing loudly here beats deriving the
 * capability line from a graph that is not this tree's.
 */
export function requireDeploymentGraph(root) {
  const absolute = path.join(root, GRAPH_PATH)
  if (!existsSync(absolute)) {
    throw new Error(
      `openapi key kind: ${GRAPH_PATH} is missing; run \`pnpm --filter operator prepare:verify\` first.`,
    )
  }
  return JSON.parse(readFileSync(absolute, "utf8"))
}

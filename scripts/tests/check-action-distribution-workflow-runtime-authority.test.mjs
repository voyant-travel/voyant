import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checker = path.join(
  repoRoot,
  "scripts/check-action-distribution-workflow-runtime-authority.mjs",
)
const fixturePaths = [
  "starters/operator/src/api/runtime/deployment-resources.ts",
  "packages/action-ledger/package.json",
  "packages/action-ledger/src/graph-runtime.ts",
  "packages/action-ledger/src/runtime-port.ts",
  "packages/action-ledger/src/voyant.ts",
  "packages/bookings/src/runtime-contributor.ts",
  "packages/finance/src/runtime-contributor.ts",
  "packages/inventory/src/runtime-contributor.ts",
  "packages/distribution/package.json",
  "packages/distribution/src/runtime-contributor.ts",
  "packages/distribution/src/runtime.ts",
  "packages/workflow-runs/src/runtime-contributor.ts",
  "packages/workflow-runs/src/runner.ts",
]

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-runtime-authority-"))
  await Promise.all(
    fixturePaths.map(async (relativePath) => {
      const target = path.join(root, relativePath)
      await mkdir(path.dirname(target), { recursive: true })
      await cp(path.join(repoRoot, relativePath), target)
    }),
  )
  return root
}

test("accepts package-owned static runtime authority", async () => {
  const result = await execFileAsync(process.execPath, [checker, "--root", await fixture()])
  assert.match(result.stdout, /Action Ledger static ports/)
})

test("rejects a missing domain drift contribution", async () => {
  const root = await fixture()
  const target = path.join(root, "packages/bookings/src/runtime-contributor.ts")
  await writeFile(
    target,
    (await readFile(target, "utf8")).replace(
      "[actionLedgerBookingDriftRuntimePort.id]",
      "[removed.id]",
    ),
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /actionLedgerBookingDriftRuntimePort must be supplied/,
  )
})

test("rejects a restored host capability", async () => {
  const root = await fixture()
  const target = path.join(root, "packages/workflow-runs/src/runtime-contributor.ts")
  await writeFile(target, `${await readFile(target, "utf8")}\nresolveWorkflowRunnerRegistry\n`)
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /workflowContributor retains resolveWorkflowRunnerRegistry/,
  )
})

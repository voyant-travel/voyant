import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checker = path.join(
  repoRoot,
  "scripts/check-operator-capability-derived-runtime-bindings.mjs",
)

async function write(root, relativePath, contents) {
  const target = path.join(root, relativePath)
  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, contents)
}

async function fixture(deploymentResources) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-capability-runtime-bindings-"))
  await write(
    root,
    "starters/operator/src/api/runtime/deployment-resources.ts",
    deploymentResources,
  )
  await write(
    root,
    "packages/auth/src/runtime-contributor.ts",
    "host.capabilities\ncloudAdminMembersConfigFromRevalidate\nauth.invitation\n",
  )
  await write(
    root,
    "packages/mice/src/runtime-contributor.ts",
    "host.capabilities.relationshipsService\nresolveDelegatePersonById\n",
  )
  await write(root, "packages/quotes/src/runtime-contributor.ts", "createQuotesRuntime(host)\n")
  await write(
    root,
    "packages/relationships/src/runtime-contributor.ts",
    "host.capabilities.customFields\n",
  )
  return root
}

it("accepts package bindings derived from generic host capabilities", async () => {
  const root = await fixture("return createGeneratedGraphRuntimePorts({ capabilities, host })\n")
  const result = await execFileAsync(process.execPath, [checker, "--root", root])
  assert.match(result.stdout, /4 package bindings derived from generic host capabilities/)
})

it("rejects starter-side assembly of a migrated binding", async () => {
  const root = await fixture(
    "return createGeneratedGraphRuntimePorts({ capabilities, mice: { resolveDelegatePersonById } })\n",
  )
  await assert.rejects(
    execFileAsync(process.execPath, [checker, "--root", root]),
    /must not assemble the mice binding/,
  )
})

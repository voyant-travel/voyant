import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const checker = path.resolve(
  fileURLToPath(import.meta.url),
  "../../check-legal-document-runtime-authority.mjs",
)

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-legal-document-runtime-"))
  const files = {
    "starters/operator/src/api/runtime/deployment-resources.ts": "generic primitives",
    "starters/operator/src/api/runtime/operator-runtime-adapter.ts":
      'import("@voyant-travel/legal-node/standard-node-runtime")',
    "packages/legal/package.json": JSON.stringify({ exports: {} }),
    "packages/legal-node/package.json": JSON.stringify({
      voyant: {
        kind: "library",
        runtime: { export: "createLegalNodeRuntimePortContribution" },
      },
      dependencies: {
        "@voyant-travel/bookings": "workspace:^",
        "@voyant-travel/legal": "workspace:^",
        "@voyant-travel/operator-settings": "workspace:^",
      },
    }),
    "packages/legal-node/src/runtime-contributor.ts":
      "createLegalStandardNodeRuntime legalRuntimePort.id legalContractDocumentRuntimePort.id legalBookingContractSubscriberRuntimePort.id",
    "packages/legal-node/src/standard-node-runtime.ts":
      "buildContractVariableBindings createContractDocumentService resolveContractDocumentGenerator resolveBookingPiiService createBookingContractSubscriberHost",
    "packages/framework/package.json": JSON.stringify({
      dependencies: { "@voyant-travel/legal-node": "workspace:*" },
    }),
    "release.runtime-packages.generated.json": JSON.stringify({
      runtimePackages: ["@voyant-travel/legal-node"],
    }),
    ...overrides,
  }
  for (const [relativePath, contents] of Object.entries(files)) {
    const target = path.join(root, relativePath)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, contents)
  }
  return root
}

it("accepts package-owned Legal document composition", async () => {
  const result = await execFileAsync(process.execPath, [checker, "--root", await fixture()])
  assert.match(result.stdout, /authority: OK/)
})

it("rejects a restored deployment Legal loader", async () => {
  const root = await fixture({
    "starters/operator/src/api/runtime/deployment-resources.ts": "loadLegalRuntime",
  })
  await assert.rejects(execFileAsync(process.execPath, [checker, "--root", root]), (error) =>
    error.stderr.includes("loadLegalRuntime"),
  )
})

it("rejects target contributor metadata on the Legal domain package", async () => {
  const root = await fixture({
    "packages/legal/package.json": JSON.stringify({
      exports: { "./runtime-contributor": "./src/runtime-contributor.ts" },
      voyant: { runtime: { export: "createLegalRuntimePortContribution" } },
    }),
  })
  await assert.rejects(execFileAsync(process.execPath, [checker, "--root", root]), (error) =>
    error.stderr.includes("must not retain target runtime contributor metadata"),
  )
})

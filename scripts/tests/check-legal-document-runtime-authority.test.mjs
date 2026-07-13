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
    "packages/operator-runtime/src/deployment-resources.ts": "generic primitives",
    "starters/operator/src/api/runtime/operator-runtime-adapter.ts":
      'import("@voyant-travel/legal/runtime")',
    "packages/legal/package.json": JSON.stringify({
      exports: {
        "./runtime-contributor": "./src/runtime-contributor.ts",
      },
      voyant: {
        kind: "module",
        runtime: { export: "createLegalRuntimePortContribution" },
      },
      dependencies: {
        "@voyant-travel/bookings": "workspace:^",
        "@voyant-travel/operator-settings": "workspace:^",
      },
    }),
    "packages/legal/src/runtime-contributor.ts":
      "createLegalRuntime legalRuntimePort.id legalContractDocumentRuntimePort.id legalBookingContractSubscriberRuntimePort.id",
    "packages/legal/src/runtime.ts":
      "buildContractVariableBindings createContractDocumentService resolveContractDocumentGenerator resolveBookingPiiService createBookingContractSubscriberHost",
    "packages/framework/package.json": JSON.stringify({
      dependencies: { "@voyant-travel/legal": "workspace:*" },
    }),
    "packages/framework/src/operator-distribution.ts":
      'modules: [{ resolve: "@voyant-travel/legal" }]',
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
    "packages/operator-runtime/src/deployment-resources.ts": "loadLegalRuntime",
  })
  await assert.rejects(execFileAsync(process.execPath, [checker, "--root", root]), (error) =>
    error.stderr.includes("loadLegalRuntime"),
  )
})

it("rejects incorrect contributor metadata on the Legal domain package", async () => {
  const root = await fixture({
    "packages/legal/package.json": JSON.stringify({
      exports: {
        "./runtime-contributor": "./src/runtime-contributor.ts",
      },
      voyant: { runtime: { export: "createLegalRuntimePortContribution" } },
    }),
  })
  await assert.rejects(execFileAsync(process.execPath, [checker, "--root", root]), (error) =>
    error.stderr.includes("must declare its standard Node runtime contributor"),
  )
})

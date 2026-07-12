import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checkerPath = path.join(repoRoot, "scripts/check-operator-runtime-ports.mjs")
const portNames = [
  "actionLedgerHealthRuntimePort",
  "bookingMaintenanceRuntimePort",
  "bookingRequirementsRuntimePort",
  "bookingsRuntimePort",
  "catalogBookingRuntimePort",
  "catalogContentRuntimePort",
  "catalogOffersRuntimePort",
  "catalogSearchRuntimePort",
  "financeBookingScheduleRuntimePort",
  "financeBookingTaxRuntimePort",
  "financeRuntimePort",
  "inventoryBrochureRuntimePort",
  "inventoryRuntimePort",
  "legalContractDocumentRuntimePort",
  "miceRuntimePort",
  "quotesProposalRuntimePort",
  "quotesRuntimePort",
  "quotesSnapshotRuntimePort",
  "smartbillRuntimeHostPort",
  "storefrontCustomerPortalRuntimePort",
  "storefrontPaymentLinkRuntimePort",
  "storefrontRuntimePort",
  "storefrontVerificationRuntimePort",
]

async function createFixture({ binding = "", framework = false } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-package-authority-"))
  const operator = path.join(root, "operator/src/api/composition.ts")
  const frameworkFile = path.join(root, "framework/src/composition-lazy.ts")
  await mkdir(path.dirname(operator), { recursive: true })
  await mkdir(path.dirname(frameworkFile), { recursive: true })
  await writeFile(
    operator,
    `export function buildOperatorRuntimePorts() { return { ${portNames.map((name) => `[${name}.id]: {}`).join(",")} } }\nasync function createOperatorBookingsRuntimeProvider() {}\n${binding}\n`,
  )
  if (framework) await writeFile(frameworkFile, "export const registry = {}\n")
  return root
}

function runChecker(root) {
  return execFileAsync(
    process.execPath,
    [
      checkerPath,
      "--operator-root",
      path.join(root, "operator"),
      "--framework-root",
      path.join(root, "framework"),
    ],
    { cwd: root },
  )
}

describe("check-operator-runtime-ports", () => {
  it("accepts typed host ports without central factories", async () => {
    const result = await runChecker(await createFixture())
    assert.match(result.stdout, /23 package runtimes are port-bound/)
  })

  it("rejects restored Operator bindings and framework factories", async () => {
    const root = await createFixture({
      binding: 'export const operatorGraphRuntimeBindings = { "@voyant-travel/quotes": factory }',
      framework: true,
    })
    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /operatorGraphRuntimeBindings must stay deleted/)
      assert.match(error.stderr, /composition-lazy\.ts must stay deleted/)
      return true
    })
  })
})

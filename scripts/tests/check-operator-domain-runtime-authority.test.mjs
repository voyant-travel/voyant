import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const checker = path.resolve(
  fileURLToPath(import.meta.url),
  "../../check-operator-domain-runtime-authority.mjs",
)

async function fixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-domain-runtime-"))
  const files = {
    "starters/operator/src/api/runtime/booking-payment-policy-runtime.ts": "package composition",
    "starters/operator/src/api/runtime/operator-workflow-services.ts": "host adapters",
    "packages/trips/src/route-runtime.ts": "runtime",
    "packages/trips/src/runtime.ts":
      "createTripsRouteRuntime createCatalogComponentAdapter VoyantRuntimeHostPrimitives",
    "packages/trips/src/checkout/voyant-fx.ts": "runtime",
    "packages/finance/src/stale-booking-holds-runtime.ts": "runtime",
    "packages/distribution/src/channel-push/workflow-entry.ts": "runtime",
    "packages/inventory/src/workflow-runtime.ts": "runtime",
    "packages/inventory/src/booking-payment-policy-runtime.ts": "runtime",
    "packages/accommodations/src/payment-policy-runtime.ts": "runtime",
    "packages/cruises/src/payment-policy-runtime.ts": "runtime",
    "packages/distribution/src/payment-policy-runtime.ts": "runtime",
    ...overrides,
  }
  for (const [relative, source] of Object.entries(files)) {
    const target = path.join(root, relative)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, source)
  }
  return root
}

describe("operator domain runtime authority", () => {
  it("accepts package-owned domain behavior", async () => {
    const result = await execFileAsync(process.execPath, [checker, "--root", await fixture()])
    assert.match(result.stdout, /authority: OK/)
  })

  it("rejects a restored starter Trips implementation", async () => {
    const root = await fixture({
      "starters/operator/src/api/runtime/trips-runtime.ts": "implementation",
    })
    await assert.rejects(execFileAsync(process.execPath, [checker, "--root", root]), (error) =>
      error.stderr.includes("Trips deployment adapter must stay deleted"),
    )
  })
})

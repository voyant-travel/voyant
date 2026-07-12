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
const checker = path.join(repoRoot, "scripts/check-phase5-event-authority.mjs")

const validManifest = `
defineModule({
  events: [{
    id: "@acme/example#event.changed",
    eventType: "example.changed",
    version: "1.0.0",
    payloadSchema: { type: "object" },
    visibility: "external",
    audit: { sourceModule: "example", category: "domain" },
  }],
  webhooks: [{
    id: "@acme/example#webhook.changed",
    direction: "outbound",
    eventId: "@acme/example#event.changed",
  }],
})
`

async function runFixture(source) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-phase5-events-"))
  const file = path.join(root, "packages/example/src/voyant.ts")
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, source)
  return execFileAsync(process.execPath, [checker, "--root", root])
}

describe("Phase 5 event authority checker", () => {
  it("accepts an external versioned event with schema and audit metadata", async () => {
    const result = await runFixture(validManifest)
    assert.match(result.stdout, /Phase 5 event authority: OK/)
  })

  it("rejects name-only outbound event eligibility", async () => {
    const invalid = validManifest
      .replace('version: "1.0.0",', "")
      .replace('visibility: "external",', "")
      .replace('payloadSchema: { type: "object" },', "")
      .replace('audit: { sourceModule: "example", category: "domain" },', "")
    await assert.rejects(runFixture(invalid), (error) => {
      assert.match(error.stderr, /must declare visibility/)
      assert.match(error.stderr, /must declare a semantic version/)
      assert.match(error.stderr, /must declare payloadSchema/)
      assert.match(error.stderr, /must declare audit sourceModule and category/)
      return true
    })
  })

  it("rejects an outbound reference without a package-owned event", async () => {
    const invalid = validManifest.replace(
      /events:\s*\[[\s\S]*?\],\n {2}webhooks:/,
      "events: [],\n  webhooks:",
    )
    await assert.rejects(runFixture(invalid), /must reference an event declared/)
  })
})

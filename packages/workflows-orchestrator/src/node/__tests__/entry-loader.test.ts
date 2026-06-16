import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { loadEntryFile } from "../entry-loader.js"

const touchedEnvKeys = ["VOYANT_ENTRY_BOOTSTRAPPED"] as const
const tempDirs: string[] = []

afterEach(async () => {
  for (const key of touchedEnvKeys) {
    delete process.env[key]
  }
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

describe("loadEntryFile", () => {
  it("runs a workflow bundle bootstrap export after import", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".tmp-entry-loader-"))
    tempDirs.push(dir)
    const entry = join(dir, "entry.mjs")
    await writeFile(
      entry,
      `
        export const loaded = true
        export function bootstrapWorkflowBundle({ env }) {
          env.VOYANT_ENTRY_BOOTSTRAPPED = "1"
        }
      `,
      "utf8",
    )

    const loaded = await loadEntryFile(entry)

    expect(loaded.exports.loaded).toBe(true)
    expect(process.env.VOYANT_ENTRY_BOOTSTRAPPED).toBe("1")
  })

  it("can skip bundle bootstrap for import-only callers", async () => {
    const dir = await mkdtemp(join(process.cwd(), ".tmp-entry-loader-"))
    tempDirs.push(dir)
    const entry = join(dir, "entry.mjs")
    await writeFile(
      entry,
      `
        export function bootstrapWorkflowBundle({ env }) {
          env.VOYANT_ENTRY_BOOTSTRAPPED = "1"
        }
      `,
      "utf8",
    )

    await loadEntryFile(entry, { runBootstrap: false })

    expect(process.env.VOYANT_ENTRY_BOOTSTRAPPED).toBeUndefined()
  })
})

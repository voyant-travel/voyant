import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")

describe("check-operator-openapi-authority", () => {
  it("keeps OpenAPI composition selected-graph and package owned", async () => {
    const result = await execFileAsync(
      process.execPath,
      [path.join(repoRoot, "scripts/check-operator-openapi-authority.mjs")],
      { cwd: repoRoot },
    )

    assert.match(result.stdout, /check-operator-openapi-authority: OK/)
  })
})

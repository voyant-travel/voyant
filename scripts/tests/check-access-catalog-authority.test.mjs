import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

test("the Operator consumes the Bookings-owned selected access catalog", () => {
  const output = execFileSync("node", ["scripts/check-access-catalog-authority.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
  assert.match(output, /access catalog authority: OK/)
})

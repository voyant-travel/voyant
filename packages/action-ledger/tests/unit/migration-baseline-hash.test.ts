import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"

import { describe, expect, it } from "vitest"

const FROZEN_BASELINE_HASH =
  "2c1f05738aedd395ffdecc7d5000144a41e6af7e7a85b85563302e89bb1f4f6c"

describe("action-ledger migration baseline", () => {
  it("preserves the historical collector content hash", async () => {
    const sql = await readFile(
      new URL("../../migrations/0000_action_ledger_baseline.sql", import.meta.url),
    )

    expect(createHash("sha256").update(sql).digest("hex")).toBe(
      FROZEN_BASELINE_HASH,
    )
  })
})

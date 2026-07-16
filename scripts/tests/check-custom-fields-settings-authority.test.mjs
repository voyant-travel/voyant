import { execFileSync } from "node:child_process"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("custom-fields Settings authority", () => {
  it("keeps generic ownership and entity target declarations", () => {
    expect(
      execFileSync("node", [resolve("scripts/check-custom-fields-settings-authority.mjs")], {
        encoding: "utf8",
      }),
    ).toContain("OK")
  })
})

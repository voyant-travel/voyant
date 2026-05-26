import { readFile } from "node:fs/promises"

import ts from "typescript"
import { describe, expect, it } from "vitest"

describe("service-rule-resolver rrule import", () => {
  it("does not emit a default import from rrule when built", async () => {
    const source = await readFile(
      new URL("../src/service-rule-resolver.ts", import.meta.url),
      "utf8",
    )
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
      fileName: "service-rule-resolver.ts",
    })

    expect(outputText).toMatch(/from ["']rrule["']/)
    expect(outputText).not.toMatch(/import\s+[A-Za-z_$][\w$]*(?:\s*,|\s+from\s+["']rrule["'])/)
  })
})

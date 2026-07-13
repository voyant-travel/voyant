import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"

import {
  OPERATOR_GENERATED_METADATA_FILES,
  writeOperatorStarterMetadata,
} from "../generate-operator-starter-metadata.mjs"

test("emits disposable operator config with rebased declaration paths", () => {
  const root = mkdtempSync(join(tmpdir(), "voyant-operator-metadata-"))
  try {
    write(
      root,
      "packages/typescript-config/dep-paths.json",
      JSON.stringify({
        compilerOptions: {
          paths: { "@voyant-travel/example": ["../example/dist/index.d.ts"] },
        },
      }),
    )

    assert.deepEqual(writeOperatorStarterMetadata(root), OPERATOR_GENERATED_METADATA_FILES)
    assert.deepEqual(writeOperatorStarterMetadata(root, { check: true }), [])

    const client = JSON.parse(
      readFileSync(join(root, "starters/operator/.voyant/tsconfig.client.json"), "utf8"),
    )
    assert.deepEqual(client.compilerOptions.paths["@/*"], ["../src/*"])
    assert.deepEqual(client.compilerOptions.paths["@voyant-travel/example"], [
      "../../../packages/example/dist/index.d.ts",
    ])
    assert.match(
      readFileSync(join(root, "starters/operator/.voyant/env.d.ts"), "utf8"),
      /VoyantNodeRuntimeEnv/,
    )

    write(root, "starters/operator/.voyant/tsconfig.legacy.json", "{}\n")
    assert.deepEqual(writeOperatorStarterMetadata(root, { check: true }), [
      "unexpected:tsconfig.legacy.json",
    ])
    assert.deepEqual(writeOperatorStarterMetadata(root), ["unexpected:tsconfig.legacy.json"])
    assert.deepEqual(writeOperatorStarterMetadata(root, { check: true }), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function write(root, path, contents) {
  const destination = join(root, path)
  mkdirSync(dirname(destination), { recursive: true })
  writeFileSync(destination, contents)
}

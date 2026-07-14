import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"

import { collectPackedSourceMapProblems } from "../lib/packed-sourcemaps.mjs"

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("reports maps whose sources are neither packed nor embedded", () => {
  const root = createFixture({
    "dist/index.js.map": JSON.stringify({
      version: 3,
      file: "index.js",
      sources: ["../src/index.ts", "../src/embedded.ts"],
      sourcesContent: [null, "export const embedded = true\n"],
      names: [],
      mappings: "",
    }),
  })

  assert.deepEqual(collectPackedSourceMapProblems(root, packedFiles("dist/index.js.map")), [
    "dist/index.js.map references unavailable sources without sourcesContent: ../src/index.ts",
  ])
})

test("accepts maps backed by packed source files", () => {
  const root = createFixture({
    "dist/index.d.ts.map": JSON.stringify({
      version: 3,
      file: "index.d.ts",
      sources: ["../src/index.ts"],
      names: [],
      mappings: "",
    }),
    "src/index.ts": "export const value = true\n",
  })

  assert.deepEqual(
    collectPackedSourceMapProblems(root, packedFiles("dist/index.d.ts.map", "src/index.ts")),
    [],
  )
})

function packedFiles(...files) {
  return { files: files.map((filePath) => ({ path: filePath })) }
}

function createFixture(files) {
  const root = mkdtempSync(path.join(tmpdir(), "voyant-packed-sourcemaps-"))
  temporaryDirectories.push(root)
  for (const [filePath, source] of Object.entries(files)) {
    const destination = path.join(root, filePath)
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, source)
  }
  return root
}

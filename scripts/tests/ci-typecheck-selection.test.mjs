import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"
import { classifyTypecheck } from "../lib/ci-typecheck-selection.mjs"

const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { force: true, recursive: true })
  }
})

test("skips a standalone typecheck when the build covers the same files", () => {
  const directory = createWorkspace({
    buildInclude: ["src/**/*"],
    typecheckInclude: ["src/**/*"],
  })

  assert.deepEqual(
    classifyTypecheck({
      directory,
      manifest: manifestWithScripts("tsc -p tsconfig.build.json"),
    }),
    { required: false, reason: "build-covers-typecheck" },
  )
})

test("keeps a standalone typecheck when it covers test files", () => {
  const directory = createWorkspace({
    buildInclude: ["src/**/*"],
    typecheckInclude: ["src/**/*", "tests/**/*"],
  })

  const result = classifyTypecheck({
    directory,
    manifest: manifestWithScripts("tsc -p tsconfig.build.json"),
  })

  assert.equal(result.required, true)
  assert.equal(result.reason, "typecheck-covers-additional-files")
  assert.equal(result.uncoveredFiles.length, 1)
})

test("keeps a standalone typecheck when the build disables checking", () => {
  const directory = createWorkspace({
    buildInclude: ["src/**/*"],
    typecheckInclude: ["src/**/*"],
  })

  assert.deepEqual(
    classifyTypecheck({
      directory,
      manifest: manifestWithScripts("tsc -p tsconfig.build.json --noCheck"),
    }),
    { required: true, reason: "build-disables-typechecking" },
  )
})

test("keeps a standalone typecheck when the build is not a TypeScript check", () => {
  const directory = createWorkspace({
    buildInclude: ["src/**/*"],
    typecheckInclude: ["src/**/*"],
  })

  assert.deepEqual(
    classifyTypecheck({
      directory,
      manifest: manifestWithScripts("vite build"),
    }),
    { required: true, reason: "build-does-not-typecheck" },
  )
})

test("keeps a standalone typecheck when semantic compiler options differ", () => {
  const directory = createWorkspace({
    buildCompilerOptions: { strict: false },
    buildInclude: ["src/**/*"],
    typecheckCompilerOptions: { strict: true },
    typecheckInclude: ["src/**/*"],
  })

  assert.deepEqual(
    classifyTypecheck({
      directory,
      manifest: manifestWithScripts("tsc -p tsconfig.build.json"),
    }),
    { required: true, reason: "typecheck-uses-different-options" },
  )
})

function manifestWithScripts(build) {
  return {
    name: "fixture",
    scripts: {
      build,
      typecheck: "tsc -p tsconfig.typecheck.json",
    },
  }
}

function createWorkspace({
  buildCompilerOptions = {},
  buildInclude,
  typecheckCompilerOptions = {},
  typecheckInclude,
}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-ci-typecheck-"))
  temporaryDirectories.push(directory)
  fs.mkdirSync(path.join(directory, "src"))
  fs.mkdirSync(path.join(directory, "tests"))
  fs.writeFileSync(path.join(directory, "src", "index.ts"), "export const value = 1;\n")
  fs.writeFileSync(path.join(directory, "tests", "index.test.ts"), "void 0;\n")
  fs.writeFileSync(
    path.join(directory, "tsconfig.build.json"),
    JSON.stringify({
      compilerOptions: { noEmit: true, ...buildCompilerOptions },
      include: buildInclude,
    }),
  )
  fs.writeFileSync(
    path.join(directory, "tsconfig.typecheck.json"),
    JSON.stringify({
      compilerOptions: { noEmit: true, ...typecheckCompilerOptions },
      include: typecheckInclude,
    }),
  )
  return directory
}

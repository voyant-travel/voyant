import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, it } from "node:test"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, "../..")
const checkerPath = path.join(repoRoot, "scripts/check-package-i18n-parity.mjs")
const tsxLoader = import.meta.resolve("tsx")
const temporaryRoots = []

async function fixtureRoot() {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-package-i18n-"))
  temporaryRoots.push(root)
  await mkdir(path.join(root, "packages"), { recursive: true })
  return root
}

async function runChecker(root) {
  try {
    const result = await execFileAsync(process.execPath, ["--import", tsxLoader, checkerPath], {
      cwd: root,
    })
    return { code: 0, output: `${result.stdout}${result.stderr}` }
  } catch (error) {
    return {
      code: error.code ?? 1,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    }
  }
}

async function writeCatalog(root, relativeDirectory, source) {
  const directory = path.join(root, "packages", relativeDirectory, "src", "i18n")
  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, "index.ts"), source)
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe("check-package-i18n-parity", () => {
  it("fails closed when no package catalogs are discovered", async () => {
    const root = await fixtureRoot()
    const result = await runChecker(root)
    assert.notEqual(result.code, 0)
    assert.match(result.output, /No package i18n entrypoints were discovered/)
  })

  it("discovers catalogs in current -react packages", async () => {
    const root = await fixtureRoot()
    await writeCatalog(
      root,
      "example-react",
      `export const exampleMessageDefinitions = {
        en: { greeting: "Hello, {name}!" },
        ro: { greeting: "Salut, {name}!" },
      }`,
    )
    const result = await runChecker(root)
    assert.equal(result.code, 0, result.output)
    assert.match(result.output, /1 definition sets across 1 package entrypoints/)
  })

  it("rejects ICU argument drift in nested package catalogs", async () => {
    const root = await fixtureRoot()
    await writeCatalog(
      root,
      "example-react/src/feature",
      `export const featureMessageDefinitions = {
        en: { result: "{count, plural, one {# result} other {# results}}" },
        ro: { result: "Rezultate" },
      }`,
    )
    const result = await runChecker(root)
    assert.notEqual(result.code, 0)
    assert.match(result.output, /ICU argument mismatch/)
  })
})

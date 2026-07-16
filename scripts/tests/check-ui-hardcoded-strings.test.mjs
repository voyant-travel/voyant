import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(fileURLToPath(import.meta.url), "../../..")
const checkerPath = path.join(repoRoot, "scripts/check-ui-hardcoded-strings.mjs")

async function createFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-ui-literals-"))
  await mkdir(path.join(root, "packages/example-ui/src/i18n"), { recursive: true })
  await writeFile(path.join(root, "packages/example-ui/src/i18n/index.ts"), "export {}\n")

  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }

  return root
}

async function runChecker(cwd) {
  return execFileAsync(process.execPath, [checkerPath], { cwd })
}

describe("check-ui-hardcoded-strings", () => {
  it("fails closed when no i18n-enabled package is discovered", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "voyant-ui-literals-empty-"))
    await mkdir(path.join(root, "packages/example/src"), { recursive: true })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /no package-owned i18n entrypoints found/)
      return true
    })
  })

  it("catches standalone JSX text split across lines", async () => {
    const root = await createFixture({
      "packages/example-ui/src/button.tsx": `export function ExampleButton() {
  return (
    <Button>
      Save changes
    </Button>
  )
}
`,
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /packages\/example-ui\/src\/button\.tsx:4 Save changes/)
      return true
    })
  })

  it("does not flag arrow-function bodies with comparisons", async () => {
    const root = await createFixture({
      "packages/example-ui/src/helpers.tsx": `export function pickFirst(entries: Array<[string, number]>) {
  const counts = new Map<string, number>()
  return entries.find(([candidate, total]) => (counts.get(candidate) ?? 0) < total)?.[0]
}
`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /ui hardcoded string scan passed/)
  })

  it("allows JSX text supplied by message expressions", async () => {
    const root = await createFixture({
      "packages/example-ui/src/button.tsx": `export function ExampleButton({ messages }) {
  return (
    <Button>
      {messages.saveChanges}
    </Button>
  )
}
`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /ui hardcoded string scan passed/)
  })

  it("ignores locale catalogs while scanning the owning package", async () => {
    const root = await createFixture({
      "packages/example-ui/src/i18n/en.ts": `export const en = { save: "Save changes" }\n`,
      "packages/example-ui/src/i18n/ro.ts": `export const ro = { save: "Salvează modificările" }\n`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /ui hardcoded string scan passed/)
  })

  it("discovers packages using a standalone i18n module", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "voyant-ui-literals-react-"))
    await mkdir(path.join(root, "packages/example-react/src"), { recursive: true })
    await writeFile(path.join(root, "packages/example-react/src/i18n.tsx"), "export {}\n")
    await writeFile(
      path.join(root, "packages/example-react/src/panel.tsx"),
      `export const Panel = () => <section title="Account settings" />\n`,
    )

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /Account settings/)
      return true
    })
  })

  it("rejects ambient toLocale formatting", async () => {
    const root = await createFixture({
      "packages/example-ui/src/total.tsx": `export function Total({ value }) {
  return <output>{value.toLocaleString()}</output>
}
`,
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /toLocaleString\(\) requires an explicit locale/)
      return true
    })
  })

  it("rejects Intl constructors with an undefined locale", async () => {
    const root = await createFixture({
      "packages/example-ui/src/date.tsx": `export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(value)
}
`,
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /Intl\.DateTimeFormat requires an explicit locale/)
      return true
    })
  })

  it("accepts locale-bound formatting", async () => {
    const root = await createFixture({
      "packages/example-ui/src/formatters.tsx": `export function formatValues(value, date, locale) {
  return [value.toLocaleString(locale), new Intl.DateTimeFormat(locale).format(date)]
}
`,
    })

    const result = await runChecker(root)

    assert.match(result.stdout, /ui hardcoded string scan passed/)
  })
})

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
  await mkdir(path.join(root, "packages/ui/registry"), { recursive: true })
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
})

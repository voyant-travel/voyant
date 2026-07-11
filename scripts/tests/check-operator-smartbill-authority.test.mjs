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
const checkerPath = path.join(repoRoot, "scripts/check-operator-smartbill-authority.mjs")

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-smartbill-authority-"))
  const files = {
    "package.json": JSON.stringify({
      dependencies: { "@voyant-travel/plugin-smartbill": "^0.138.0" },
    }),
    "voyant.config.ts":
      'export default { plugins: [{ resolve: "@voyant-travel/plugin-smartbill" }] }\n',
    "src/api/app.ts": "export const app = mountApp({})\n",
    "src/api/composition.ts":
      'export const bindings = { "@voyant-travel/plugin-smartbill": registerOperatorSmartbillSubscriberRuntimeService }\n',
    "src/api/runtime/smartbill-subscriber-runtime.ts":
      'import { SMARTBILL_SUBSCRIBER_RUNTIME_KEY } from "@voyant-travel/plugin-smartbill/subscriber-runtime"\ncontext.container.register(SMARTBILL_SUBSCRIBER_RUNTIME_KEY, runtime)\n',
    "installed/package.json": JSON.stringify({
      version: "0.138.0",
      voyant: { kind: "plugin", manifest: "./voyant" },
      exports: { "./voyant": "./voyant.js", "./subscriber-runtime": "./runtime.js" },
    }),
    ...overrides,
  }
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    await mkdir(path.dirname(filePath), { recursive: true })
    await writeFile(filePath, content)
  }
  return root
}

async function runChecker(root) {
  return execFileAsync(
    process.execPath,
    [
      checkerPath,
      "--operator-root",
      root,
      "--installed-package-root",
      path.join(root, "installed"),
    ],
    { cwd: root },
  )
}

describe("check-operator-smartbill-authority", () => {
  it("accepts direct package admission with an operator runtime adapter", async () => {
    const root = await createFixture()

    const result = await runChecker(root)

    assert.match(result.stdout, /check-operator-smartbill-authority: OK/)
  })

  it("rejects compatibility mounts and operator-owned descriptor registration", async () => {
    const root = await createFixture({
      "src/api/app.ts":
        'import { smartbillOperatorBundle } from "./subscribers/smartbill-bundle"\n',
      "src/api/runtime/smartbill-subscriber-runtime.ts":
        'eventBus.subscribe("invoice.issued", handler)\ndescriptor.register(context)\n',
      "src/api/subscribers/smartbill.ts": "export const legacy = true\n",
    })

    await assert.rejects(runChecker(root), (error) => {
      assert.match(error.stderr, /must not own or register SmartBill subscriber descriptors/)
      assert.match(error.stderr, /must not mount or import a SmartBill compatibility bundle/)
      assert.match(error.stderr, /smartbill\.ts must stay deleted/)
      return true
    })
  })
})

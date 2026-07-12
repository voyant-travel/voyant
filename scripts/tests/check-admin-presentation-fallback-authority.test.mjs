import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import test from "node:test"

const checker = join(import.meta.dirname, "..", "check-admin-presentation-fallback-authority.mjs")
const messagePackages = [
  ["auth-react", 2],
  ["distribution-react", 1],
  ["finance-react", 2],
  ["commerce-react", 2],
  ["inventory-react", 2],
]

function write(root, path, source) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "voyant-admin-presentation-"))
  const providers = messagePackages
    .flatMap(([name, count]) =>
      Array.from(
        { length: count },
        () => `routeMessagesProvider: () => import("@voyant-travel/${name}/i18n")`,
      ),
    )
    .join("\n")
  write(
    root,
    "packages/admin-host/src/admin-presentation.ts",
    "export const defaultAdminHostNavMessages = {}\n",
  )
  write(
    root,
    "packages/admin-host/package.json",
    JSON.stringify({ dependencies: {}, devDependencies: {}, peerDependencies: {} }),
  )
  write(root, "packages/admin-app/src/core-extension/index.tsx", providers)
  write(
    root,
    "packages/relationships-react/src/admin/index.tsx",
    "routeMessagesProvider: relationshipsRouteMessagesProvider\n",
  )
  return root
}

function run(root) {
  const result = spawnSync(process.execPath, [checker, "--root", root], { encoding: "utf8" })
  if (result.status !== 0) throw new Error(`${result.stdout}${result.stderr}`)
  return result.stdout
}

test("accepts route-owned package copy with only generic host fallback copy", () => {
  const root = createFixture()
  try {
    assert.match(run(root), /Admin presentation fallback authority: OK/)
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

test("rejects a package-keyed host provider registry", () => {
  const root = createFixture()
  try {
    write(
      root,
      "packages/admin-host/src/admin-presentation.ts",
      'const coreRouteMessagesProviders = { account: import("@voyant-travel/auth-react/i18n") }\n' +
        "export const defaultAdminHostNavMessages = {}\n",
    )
    assert.throws(() => run(root), /compatibility registry token coreRouteMessagesProviders/)
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

test("rejects missing route-owned provider metadata and stale host dependencies", () => {
  const root = createFixture()
  try {
    write(root, "packages/admin-app/src/core-extension/index.tsx", "routeMessagesProvider: x\n")
    write(
      root,
      "packages/admin-host/package.json",
      JSON.stringify({ peerDependencies: { "@voyant-travel/finance-react": "workspace:^" } }),
    )
    assert.throws(
      () => run(root),
      (error) => {
        assert.match(error.message, /route-owned loaders/)
        assert.match(
          error.message,
          /admin-host\/package\.json retains peerDependencies entry @voyant-travel\/finance-react/,
        )
        return true
      },
    )
  } finally {
    rmSync(root, { force: true, recursive: true })
  }
})

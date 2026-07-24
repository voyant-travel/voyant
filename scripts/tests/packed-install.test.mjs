import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, test } from "node:test"
import { promisify } from "node:util"

import {
  collectStagedPeerInstallExclusions,
  createPackedInstallManifest,
  verifyPackedPackageInstall,
} from "../lib/packed-install.mjs"

const execFileAsync = promisify(execFile)
const temporaryDirectories = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test("creates a deterministic install manifest from packed packages", () => {
  const manifest = createPackedInstallManifest([
    { name: "@voyant-travel/zeta", tarballPath: "/tmp/zeta.tgz" },
    { name: "@voyant-travel/alpha", tarballPath: "/tmp/alpha.tgz" },
  ])

  assert.deepEqual(Object.keys(manifest.dependencies), [
    "@voyant-travel/alpha",
    "@voyant-travel/zeta",
  ])
  assert.equal(manifest.dependencies["@voyant-travel/alpha"], "file:/tmp/alpha.tgz")
})

test("rejects package-manager protocols in a transitive packed dependency", async () => {
  const fixtureRoot = createTemporaryDirectory("voyant-packed-install-fixture-")
  const brokenTarball = await packFixture(fixtureRoot, "broken", {
    name: "@fixture/broken",
    version: "1.0.0",
    dependencies: { zod: "catalog:" },
  })
  const consumerTarball = await packFixture(fixtureRoot, "consumer", {
    name: "@fixture/consumer",
    version: "1.0.0",
    dependencies: { "@fixture/broken": `file:${brokenTarball}` },
  })

  await assert.rejects(
    verifyPackedPackageInstall([{ name: "@fixture/consumer", tarballPath: consumerTarball }]),
    /Unsupported URL Type "catalog:"/,
  )
})

test("does not install an optional provider peer", async () => {
  const fixtureRoot = createTemporaryDirectory("voyant-packed-optional-peer-")
  const consumerTarball = await packFixture(fixtureRoot, "consumer", {
    name: "@fixture/consumer",
    version: "1.0.0",
    peerDependencies: { "@fixture/provider": "1.0.0" },
    peerDependenciesMeta: { "@fixture/provider": { optional: true } },
  })

  await verifyPackedPackageInstall([{ name: "@fixture/consumer", tarballPath: consumerTarball }])
})

test("defers only peer mismatches covered by the release plan", () => {
  const exclusions = collectStagedPeerInstallExclusions(
    [
      {
        manifest: {
          name: "@fixture/provider",
          version: "0.9.0",
        },
      },
      {
        manifest: {
          name: "@fixture/consumer",
          version: "1.0.0",
          peerDependencies: { "@fixture/provider": "^1.0.0" },
        },
      },
      {
        manifest: {
          name: "@fixture/current-consumer",
          version: "1.0.0",
          peerDependencies: { "@fixture/provider": ">=0.9.0" },
        },
      },
    ],
    new Map([
      ["@fixture/provider", "1.0.0"],
      ["@fixture/consumer", "1.1.0"],
    ]),
  )

  assert.deepEqual([...exclusions], ["@fixture/consumer"])
})

test("rejects a peer mismatch not covered by the release plan", () => {
  assert.throws(
    () =>
      collectStagedPeerInstallExclusions(
        [
          {
            manifest: {
              name: "@fixture/provider",
              version: "0.9.0",
            },
          },
          {
            manifest: {
              name: "@fixture/consumer",
              version: "1.0.0",
              peerDependencies: { "@fixture/provider": "^1.0.0" },
            },
          },
        ],
        new Map([
          ["@fixture/provider", "0.10.0"],
          ["@fixture/consumer", "1.1.0"],
        ]),
      ),
    /not covered by the release plan/,
  )
})

function createTemporaryDirectory(prefix) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

async function packFixture(root, directoryName, manifest) {
  const packageDir = path.join(root, directoryName)
  const packDir = path.join(root, "tarballs")
  fs.mkdirSync(packageDir, { recursive: true })
  fs.mkdirSync(packDir, { recursive: true })
  fs.writeFileSync(path.join(packageDir, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`)

  const { stdout } = await execFileAsync(
    "npm",
    ["pack", "--json", "--ignore-scripts", "--pack-destination", packDir],
    { cwd: packageDir, encoding: "utf8" },
  )
  const packOutput = JSON.parse(stdout)
  const packInfo = Array.isArray(packOutput)
    ? packOutput[0]
    : (packOutput.filename ?? Object.values(packOutput)[0])
  return path.join(packDir, packInfo.filename)
}

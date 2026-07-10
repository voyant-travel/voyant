import assert from "node:assert/strict"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import type { VoyantGraphPackageRecord } from "../../packages/framework/src/deployment-graph.ts"
import { loadVoyantPackageManifests } from "../lib/load-voyant-package-manifests.ts"

describe("loadVoyantPackageManifests", () => {
  it("loads an import-only manifest export from an installed package", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "voyant-package-manifest-"))
    const projectRoot = path.join(repoRoot, "app")
    const packageRoot = path.join(projectRoot, "node_modules", "@acme", "loyalty")
    await mkdir(packageRoot, { recursive: true })
    await writeFile(path.join(projectRoot, "package.json"), JSON.stringify({ type: "module" }))
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "@acme/loyalty",
        type: "module",
        exports: {
          "./voyant": {
            node: { require: "./graph-manifest.cjs" },
            import: ["../invalid.mjs", null, "./graph-manifest.mjs"],
          },
        },
      }),
    )
    await writeFile(
      path.join(packageRoot, "graph-manifest.mjs"),
      `export default { schemaVersion: "voyant.module.v1", id: "@acme/loyalty" }\n`,
    )

    const record: VoyantGraphPackageRecord = {
      packageName: "@acme/loyalty",
      source: { kind: "registry" },
      metadata: {
        schemaVersion: "voyant.package.v1",
        kind: "module",
        manifest: "./voyant",
      },
    }

    const manifests = await loadVoyantPackageManifests(record, { projectRoot, repoRoot })

    assert.deepEqual(
      manifests.map((manifest) => manifest.id),
      ["@acme/loyalty"],
    )
  })

  it("rejects manifest export targets outside the package", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "voyant-package-manifest-"))
    const projectRoot = path.join(repoRoot, "app")
    const packageRoot = path.join(projectRoot, "node_modules", "@acme", "loyalty")
    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "@acme/loyalty",
        exports: { "./voyant": "./../../../escape.mjs" },
      }),
    )

    const record: VoyantGraphPackageRecord = {
      packageName: "@acme/loyalty",
      source: { kind: "registry" },
      metadata: {
        schemaVersion: "voyant.package.v1",
        kind: "module",
        manifest: "./voyant",
      },
    }

    await assert.rejects(
      loadVoyantPackageManifests(record, { projectRoot, repoRoot }),
      /manifest export target must stay inside the package/,
    )
  })

  it("does not fall through an explicit null export condition", async () => {
    const repoRoot = await mkdtemp(path.join(tmpdir(), "voyant-package-manifest-"))
    const projectRoot = path.join(repoRoot, "app")
    const packageRoot = path.join(projectRoot, "node_modules", "@acme", "loyalty")
    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: "@acme/loyalty",
        exports: { "./voyant": { node: null, import: "./graph-manifest.mjs" } },
      }),
    )
    await writeFile(
      path.join(packageRoot, "graph-manifest.mjs"),
      `export default { schemaVersion: "voyant.module.v1", id: "@acme/loyalty" }\n`,
    )

    const record: VoyantGraphPackageRecord = {
      packageName: "@acme/loyalty",
      source: { kind: "registry" },
      metadata: {
        schemaVersion: "voyant.package.v1",
        kind: "module",
        manifest: "./voyant",
      },
    }

    await assert.rejects(
      loadVoyantPackageManifests(record, { projectRoot, repoRoot }),
      /does not export \.\/voyant/,
    )
  })
})

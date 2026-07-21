import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("typescript", () => {
  throw new Error("TypeScript compiler loaded for a source-free project")
})

import { defineProject, resolveProject } from "./project.js"

const fixtureRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    fixtureRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
  )
})

describe("source-free project resolution", () => {
  it("composes a dist-only application without loading TypeScript", async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), "voyant-source-free-project-"))
    fixtureRoots.push(projectRoot)
    const packageJsonPath = path.join(projectRoot, "package.json")
    await writeFile(
      packageJsonPath,
      `${JSON.stringify(
        {
          name: "source-free-application",
          version: "1.0.0",
          type: "module",
        },
        null,
        2,
      )}\n`,
    )

    const resolved = await resolveProject({
      project: defineProject({ modules: [] }),
      projectRoot,
      configPath: packageJsonPath,
    })

    expect(resolved.conventions).toEqual({ contributions: [], diagnostics: [] })
    expect(resolved.graph.modules).toEqual([])
    expect(resolved.graph.extensions).toEqual([])
    expect(resolved.graph.plugins).toEqual([])
    expect(resolved.artifacts.files.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "runtime/project-api.generated.ts",
        "runtime/project-links.generated.ts",
        "runtime/project-subscribers.generated.ts",
      ]),
    )
  })
})

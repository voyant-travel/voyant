import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"
import { writeProjectArtifacts } from "./project-artifacts.js"
import type { FrameworkGeneratedProjectFile, ResolvedProjectArtifacts } from "./project-resolver.js"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  )
})

describe("writeProjectArtifacts", () => {
  it("writes nested files in deterministic order and preserves unchanged files", async () => {
    const projectRoot = await temporaryProject()
    const artifacts = projectArtifacts([
      { path: "runtime/z.generated.ts", contents: "export const z = true\n" },
      { path: "admin/a.generated.ts", contents: "export const a = true\n" },
    ])

    const first = await writeProjectArtifacts({ projectRoot, artifacts })
    const firstStats = await stat(path.join(projectRoot, ".voyant/admin/a.generated.ts"))
    const second = await writeProjectArtifacts({ projectRoot, artifacts })
    const secondStats = await stat(path.join(projectRoot, ".voyant/admin/a.generated.ts"))

    expect(first).toEqual({
      mode: "write",
      outputRoot: path.join(projectRoot, ".voyant"),
      ok: true,
      files: [
        { path: "admin/a.generated.ts", status: "written" },
        { path: "runtime/z.generated.ts", status: "written" },
      ],
    })
    expect(second.files).toEqual([
      { path: "admin/a.generated.ts", status: "unchanged" },
      { path: "runtime/z.generated.ts", status: "unchanged" },
    ])
    expect(secondStats.mtimeMs).toBe(firstStats.mtimeMs)
    expect(await readFile(path.join(projectRoot, ".voyant/runtime/z.generated.ts"), "utf8")).toBe(
      "export const z = true\n",
    )
    expect(await readdir(path.join(projectRoot, ".voyant/admin"))).toEqual(["a.generated.ts"])
  })

  it("reports unchanged, stale, and missing files without writing in check mode", async () => {
    const projectRoot = await temporaryProject()
    await mkdir(path.join(projectRoot, ".voyant/runtime"), { recursive: true })
    await writeFile(path.join(projectRoot, ".voyant/runtime/current.ts"), "current\n")
    await writeFile(path.join(projectRoot, ".voyant/runtime/stale.ts"), "old\n")
    const artifacts = projectArtifacts([
      { path: "runtime/stale.ts", contents: "new\n" },
      { path: "runtime/missing.ts", contents: "missing\n" },
      { path: "runtime/current.ts", contents: "current\n" },
    ])

    const result = await writeProjectArtifacts({ projectRoot, artifacts, mode: "check" })

    expect(result.ok).toBe(false)
    expect(result.files).toEqual([
      { path: "runtime/current.ts", status: "unchanged" },
      { path: "runtime/missing.ts", status: "missing" },
      { path: "runtime/stale.ts", status: "stale" },
    ])
    expect(await readFile(path.join(projectRoot, ".voyant/runtime/stale.ts"), "utf8")).toBe("old\n")
    await expect(stat(path.join(projectRoot, ".voyant/runtime/missing.ts"))).rejects.toMatchObject({
      code: "ENOENT",
    })
  })

  it.each([
    "../outside.ts",
    "/absolute.ts",
    "C:\\absolute.ts",
    "runtime//alias.ts",
  ])("rejects unsafe artifact path %s before creating output", async (artifactPath) => {
    const projectRoot = await temporaryProject()
    const artifacts = projectArtifacts([{ path: artifactPath, contents: "unsafe\n" }])

    await expect(writeProjectArtifacts({ projectRoot, artifacts })).rejects.toThrow(
      /must (?:be relative|not escape)/,
    )
    await expect(stat(path.join(projectRoot, ".voyant"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("rejects duplicate portable paths before writing any artifact", async () => {
    const projectRoot = await temporaryProject()
    const artifacts = projectArtifacts([
      { path: "runtime/entry.ts", contents: "first\n" },
      { path: "Runtime\\Entry.ts", contents: "second\n" },
    ])

    await expect(writeProjectArtifacts({ projectRoot, artifacts })).rejects.toThrow(
      "Duplicate project artifact paths",
    )
    await expect(stat(path.join(projectRoot, ".voyant"))).rejects.toMatchObject({ code: "ENOENT" })
  })

  it("rejects unsafe runtime references even when they are not file entries", async () => {
    const projectRoot = await temporaryProject()
    const artifacts = { ...projectArtifacts([]), runtimeEntry: "../runtime.ts" }

    await expect(writeProjectArtifacts({ projectRoot, artifacts })).rejects.toThrow(
      "artifacts.runtimeEntry",
    )
  })

  it("rejects symbolic-link traversal before writing any artifact", async () => {
    const projectRoot = await temporaryProject()
    const outsideRoot = await temporaryProject()
    await mkdir(path.join(projectRoot, ".voyant"))
    await symlink(outsideRoot, path.join(projectRoot, ".voyant/runtime"), "dir")
    const artifacts = projectArtifacts([
      { path: "admin/safe.ts", contents: "safe\n" },
      { path: "runtime/escaped.ts", contents: "escaped\n" },
    ])

    await expect(writeProjectArtifacts({ projectRoot, artifacts })).rejects.toThrow(
      "traverses a symbolic link",
    )
    expect(await readdir(outsideRoot)).toEqual([])
    await expect(stat(path.join(projectRoot, ".voyant/admin"))).rejects.toMatchObject({
      code: "ENOENT",
    })
  })
})

async function temporaryProject(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "voyant-project-artifacts-"))
  temporaryRoots.push(root)
  return root
}

function projectArtifacts(
  files: readonly FrameworkGeneratedProjectFile[],
): ResolvedProjectArtifacts {
  return {
    runtimeEntry: "runtime/project-runtime.generated.ts",
    migrationRunner: "runtime/project-migrations.generated.mjs",
    files,
    migrationPlan: {
      schemaVersion: "voyant.migration-plan.v1",
      contentHash: "sha256:test",
      migrations: [],
    },
  }
}

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { NodeServerHandle } from "@voyant-travel/runtime-core"
import { afterEach, describe, expect, it, vi } from "vitest"

import { loadBuiltProjectStart, startVoyantProjectWithDependencies } from "./project-start.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

describe("production project start", () => {
  it("uses the bundled start export when the production build provides it", async () => {
    const handle = {} as NodeServerHandle
    const builtStart = vi.fn(async () => handle)
    const loadProject = vi.fn()
    const env = { NODE_ENV: "production" }
    const host = { config: { custom: true } }

    await expect(
      startVoyantProjectWithDependencies(
        {
          adminAssetsDir: "/workspace/operator/dist/client",
          env,
          host,
          port: 4400,
          preferBuiltAdminAssets: true,
          projectRoot: "/workspace/operator",
        },
        { loadBuiltStart: vi.fn(async () => builtStart), loadProject },
      ),
    ).resolves.toBe(handle)

    expect(builtStart).toHaveBeenCalledWith({
      adminAssetsDir: "/workspace/operator/dist/client",
      env,
      host,
      port: 4400,
      preferBuiltAdminAssets: true,
      projectRoot: "/workspace/operator",
    })
    expect(loadProject).not.toHaveBeenCalled()
  })

  it("rejects a legacy bundle with no start export instead of loading SSR from source", async () => {
    const projectRoot = await createTemporaryDirectory()
    const entry = path.join(projectRoot, "dist/server/server.js")
    await mkdir(path.dirname(entry), { recursive: true })
    await writeFile(entry, "export default { fetch() {} }\n")
    const loadProject = vi.fn()

    await expect(
      startVoyantProjectWithDependencies(
        { port: 4400, preferBuiltAdminAssets: true, projectRoot },
        { loadBuiltStart: loadBuiltProjectStart, loadProject },
      ),
    ).rejects.toThrow(
      "does not export default.start. Update src/server.ts to the current starter contract",
    )
    expect(loadProject).not.toHaveBeenCalled()
  })

  it("requires a production build before startup", async () => {
    const projectRoot = await createTemporaryDirectory()
    const loadProject = vi.fn()

    await expect(
      startVoyantProjectWithDependencies(
        { port: 4400, preferBuiltAdminAssets: true, projectRoot },
        { loadBuiltStart: loadBuiltProjectStart, loadProject },
      ),
    ).rejects.toThrow("Run `voyant build` before `voyant start`")
    expect(loadProject).not.toHaveBeenCalled()
  })
})

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "voyant-project-start-"))
  temporaryDirectories.push(directory)
  return directory
}

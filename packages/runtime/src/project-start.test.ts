import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import type { NodeServerHandle } from "@voyant-travel/runtime-core"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  loadBuiltProjectStart,
  startVoyantProjectWithDependencies,
} from "./project-start.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

describe("production project start", () => {
  it("uses the bundled start export when the production build provides it", async () => {
    const handle = {} as NodeServerHandle
    const builtStart = vi.fn(async () => handle)
    const loadProject = vi.fn()

    await expect(
      startVoyantProjectWithDependencies(
        { port: 4400, preferBuiltAdminAssets: true, projectRoot: "/workspace/operator" },
        { loadBuiltStart: vi.fn(async () => builtStart), loadProject },
      ),
    ).resolves.toBe(handle)

    expect(builtStart).toHaveBeenCalledWith({
      port: 4400,
      projectRoot: "/workspace/operator",
    })
    expect(loadProject).not.toHaveBeenCalled()
  })

  it("falls back to source startup when a legacy bundle has no start export", async () => {
    const projectRoot = await createTemporaryDirectory()
    const entry = path.join(projectRoot, "dist/server/server.js")
    await mkdir(path.dirname(entry), { recursive: true })
    await writeFile(entry, "export default { fetch() {} }\n")
    const start = vi.fn(() => ({}) as NodeServerHandle)
    const loadProject = vi.fn(async () => ({ start }))

    await expect(loadBuiltProjectStart(projectRoot)).resolves.toBeUndefined()
    await startVoyantProjectWithDependencies(
      { port: 4400, preferBuiltAdminAssets: true, projectRoot },
      { loadBuiltStart: loadBuiltProjectStart, loadProject },
    )

    expect(loadProject).toHaveBeenCalledWith(
      expect.objectContaining({ port: 4400, preferBuiltAdminAssets: true, projectRoot }),
    )
    expect(start).toHaveBeenCalledWith({ port: 4400 })
  })
})

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "voyant-project-start-"))
  temporaryDirectories.push(directory)
  return directory
}

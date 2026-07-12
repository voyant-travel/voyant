import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  loadVoyantNodeRuntime: vi.fn(async (options: unknown) => ({
    app: {
      fetch: () => new Response("runtime fallback", { status: 418 }),
    },
    env: {},
    options,
  })),
}))

vi.mock("@voyant-travel/framework/node-runtime", () => ({
  createVoyantNodeEnv: (env: Record<string, string | undefined>) => env,
  createVoyantNodeRuntimeHostPrimitives: () => ({}),
  loadVoyantNodeRuntime: mocks.loadVoyantNodeRuntime,
}))

import { loadOperatorProject, OperatorProjectLayoutError } from "./index.js"

const temporaryDirectories: string[] = []

afterEach(async () => {
  mocks.loadVoyantNodeRuntime.mockClear()
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true })),
  )
})

describe("operator project layout resolution", () => {
  it("loads generated artifacts from the source .voyant layout", async () => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, ".voyant", "source-hash")
    await writeAsset(projectRoot, ".voyant/admin/client/source.txt", "source asset")

    const host = await loadOperatorProject({ projectRoot })

    expect(host.graphHash).toBe("source-hash")
    expect(mocks.loadVoyantNodeRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentRequirements: { resources: [{ id: "source-hash" }] },
      }),
    )
  })

  it("falls back to generated artifacts in dist/.voyant", async () => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, "dist/.voyant", "dist-hash")
    await writeAsset(projectRoot, "dist/client/dist.txt", "dist asset")

    const host = await loadOperatorProject({ projectRoot })

    expect(host.graphHash).toBe("dist-hash")
    expect(mocks.loadVoyantNodeRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentRequirements: { resources: [{ id: "dist-hash" }] },
      }),
    )
  })

  it.each([
    {
      name: "an explicit directory",
      explicit: true,
      expected: "explicit asset",
    },
    {
      name: "dist/client",
      explicit: false,
      expected: "dist asset",
    },
    {
      name: ".voyant/admin/client",
      explicit: false,
      expected: "generated asset",
      omitDist: true,
    },
  ])("selects and serves admin assets from $name", async ({ explicit, expected, omitDist }) => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, ".voyant", "asset-hash")
    await writeAsset(projectRoot, ".voyant/admin/client/selected.txt", "generated asset")
    if (!omitDist) {
      await writeAsset(projectRoot, "dist/client/selected.txt", "dist asset")
    }
    const explicitDir = path.join(projectRoot, "custom-admin")
    if (explicit) {
      await writeAsset(projectRoot, "custom-admin/selected.txt", "explicit asset")
    }

    const host = await loadOperatorProject({
      projectRoot,
      ...(explicit ? { adminAssetsDir: explicitDir } : {}),
    })
    const server = host.start({ port: 0 })

    try {
      const port = await listeningPort(server)
      const response = await fetch(`http://127.0.0.1:${port}/selected.txt`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe(expected)
    } finally {
      await server.close()
    }
  })

  it("preserves generated runtime and graph hash validation", async () => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, ".voyant", "runtime-hash", "graph-hash")
    await writeAsset(projectRoot, "dist/client/admin.txt", "admin")

    await expect(loadOperatorProject({ projectRoot })).rejects.toThrow(
      "Generated project runtime and deployment graph hashes do not match.",
    )
  })

  it("fails clearly when neither generated artifact layout is complete", async () => {
    const projectRoot = await createProject()
    await writeFileAt(projectRoot, ".voyant/runtime/project-runtime.generated.ts", "export {}")
    await writeFileAt(projectRoot, "dist/.voyant/deployment-graph.generated.json", "{}")

    await expect(loadOperatorProject({ projectRoot })).rejects.toMatchObject({
      name: "OperatorProjectLayoutError",
      code: "MISSING_GENERATED_ARTIFACTS",
      message: expect.stringContaining("dist/.voyant/runtime/project-runtime.generated.ts"),
    })
  })

  it("boots an API-only project without creating an empty admin client directory", async () => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, ".voyant", "missing-admin-hash")

    const host = await loadOperatorProject({ projectRoot })
    const server = host.start({ port: 0 })

    try {
      const port = await listeningPort(server)
      const response = await fetch(`http://127.0.0.1:${port}/api-only`)
      expect(response.status).toBe(418)
      expect(await response.text()).toBe("runtime fallback")
      await expect(
        import("node:fs/promises").then(({ stat }) =>
          stat(path.join(projectRoot, ".voyant/admin/client")),
        ),
      ).rejects.toMatchObject({ code: "ENOENT" })
    } finally {
      await server.close()
    }
  })

  it("fails clearly when an explicit admin assets directory is empty", async () => {
    const projectRoot = await createProject()
    await writeArtifacts(projectRoot, ".voyant", "missing-admin-hash")
    const explicit = path.join(projectRoot, "custom-admin")
    await mkdir(explicit, { recursive: true })

    const error = (await loadOperatorProject({
      projectRoot,
      adminAssetsDir: explicit,
    }).catch((caught: unknown) => caught)) as OperatorProjectLayoutError

    expect(error).toBeInstanceOf(OperatorProjectLayoutError)
    expect(error).toMatchObject({ code: "MISSING_ADMIN_ASSETS" })
    expect(error.message).toContain(explicit)
  })
})

async function createProject(): Promise<string> {
  const projectRoot = await mkdtemp(path.join(os.tmpdir(), "voyant-operator-runtime-"))
  temporaryDirectories.push(projectRoot)
  return projectRoot
}

async function listeningPort(
  handle: ReturnType<Awaited<ReturnType<typeof loadOperatorProject>>["start"]>,
): Promise<number> {
  if (!handle.server.listening) {
    await new Promise<void>((resolve) => handle.server.once("listening", resolve))
  }
  return (handle.server.address() as AddressInfo).port
}

async function writeArtifacts(
  projectRoot: string,
  layout: ".voyant" | "dist/.voyant",
  runtimeHash: string,
  graphHash = runtimeHash,
): Promise<void> {
  await writeFileAt(
    projectRoot,
    `${layout}/runtime/project-runtime.generated.ts`,
    `export function createGeneratedProjectRuntime() {
  return {
    kind: "application",
    graphHash: ${JSON.stringify(runtimeHash)},
    deployment: { providers: {} },
    graphRuntime: {},
    createRuntimePorts: () => ({}),
  }
}
`,
  )
  await writeFileAt(
    projectRoot,
    `${layout}/deployment-graph.generated.json`,
    JSON.stringify({ contentHash: graphHash, requirements: { resources: [{ id: graphHash }] } }),
  )
}

async function writeAsset(projectRoot: string, relativePath: string, contents: string): Promise<void> {
  await writeFileAt(projectRoot, relativePath, contents)
}

async function writeFileAt(
  projectRoot: string,
  relativePath: string,
  contents: string,
): Promise<void> {
  const file = path.join(projectRoot, relativePath)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, contents)
}

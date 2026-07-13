import { access } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

import type { NodeServerHandle } from "@voyant-travel/runtime-core"

const BUILT_SERVER_ENTRY = "dist/server/server.js"

interface ProjectStartOptions {
  projectRoot?: string
  port?: number
  preferBuiltAdminAssets?: boolean
}

interface ProjectHost {
  start(options?: { port?: number }): NodeServerHandle
}

export type BuiltProjectStart<TOptions extends ProjectStartOptions = ProjectStartOptions> = (
  options: TOptions & { projectRoot: string },
) => Promise<NodeServerHandle>

export interface ProjectStartDependencies<TOptions extends ProjectStartOptions> {
  loadBuiltStart(projectRoot: string): Promise<BuiltProjectStart<TOptions> | undefined>
  loadProject(options: TOptions & { projectRoot: string }): Promise<ProjectHost>
}

export async function startVoyantProjectWithDependencies<TOptions extends ProjectStartOptions>(
  options: TOptions,
  dependencies: ProjectStartDependencies<TOptions>,
): Promise<NodeServerHandle> {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd())
  if (options.preferBuiltAdminAssets) {
    const builtStart = await dependencies.loadBuiltStart(projectRoot)
    if (builtStart) return builtStart({ ...options, projectRoot })
  }

  const host = await dependencies.loadProject({ ...options, projectRoot })
  return host.start({ port: options.port })
}

export async function loadBuiltProjectStart<TOptions extends ProjectStartOptions>(
  projectRoot: string,
): Promise<BuiltProjectStart<TOptions> | undefined> {
  const entry = path.join(projectRoot, BUILT_SERVER_ENTRY)
  try {
    await access(entry)
  } catch {
    return undefined
  }

  const namespace = (await import(pathToFileURL(entry).href)) as {
    default?: { start?: BuiltProjectStart<TOptions> }
  }
  return typeof namespace.default?.start === "function"
    ? namespace.default.start.bind(namespace.default)
    : undefined
}

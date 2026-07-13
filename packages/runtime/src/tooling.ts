import {
  buildVoyantProjectWithDependencies,
  developVoyantProjectWithDependencies,
} from "./tooling-internal.js"

export interface BuildVoyantProjectOptions {
  /** Voyant application root. Defaults to the current working directory. */
  projectRoot?: string
}

export interface DevelopVoyantProjectOptions extends BuildVoyantProjectOptions {
  /** Host passed to Vite. */
  host?: string
  /** Development server port. Defaults to 3300. */
  port?: number
}

export interface VoyantProjectDevelopmentServer {
  url: string
  close(): Promise<void>
}

/** Build the complete TanStack Start Node application and its deployment artifacts. */
export async function buildVoyantProject(options: BuildVoyantProjectOptions = {}): Promise<void> {
  await buildVoyantProjectWithDependencies(options)
}

/** Start the complete TanStack Start application in Vite's SSR development mode. */
export async function developVoyantProject(
  options: DevelopVoyantProjectOptions = {},
): Promise<VoyantProjectDevelopmentServer> {
  return developVoyantProjectWithDependencies(options)
}

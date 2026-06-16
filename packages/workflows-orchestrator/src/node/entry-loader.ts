import { realpath } from "node:fs/promises"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

export interface EntryFile {
  exports: Record<string, unknown>
}

export interface WorkflowBundleBootstrapContext {
  env: NodeJS.ProcessEnv
}

export type WorkflowBundleBootstrap = (ctx: WorkflowBundleBootstrapContext) => void | Promise<void>

export interface LoadEntryOptions {
  cacheBust?: boolean
  runBootstrap?: boolean
}

export async function loadEntryFile(
  path: string,
  options: LoadEntryOptions = {},
): Promise<EntryFile> {
  const resolved = resolve(process.cwd(), path)
  const absolute = await realpath(resolved).catch(() => resolved)
  const baseUrl = pathToFileURL(absolute).href
  const url = options.cacheBust ? `${baseUrl}?t=${Date.now()}` : baseUrl
  try {
    const mod = (await import(url)) as Record<string, unknown>
    if (options.runBootstrap !== false) {
      await runWorkflowBundleBootstrap(mod)
    }
    return { exports: mod }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(
      `voyant: failed to load entry file ${path}: ${message}\n` +
        "Hint: pass a compiled .js / .mjs file, or run `voyant workflows build` / " +
        "`voyant dev` on a .ts source to bundle with esbuild first.",
    )
  }
}

export async function runWorkflowBundleBootstrap(
  mod: Record<string, unknown>,
  ctx: WorkflowBundleBootstrapContext = { env: process.env },
): Promise<void> {
  const bootstrap = mod.bootstrapWorkflowBundle
  if (bootstrap === undefined) return
  if (typeof bootstrap !== "function") {
    throw new Error("voyant: workflow entry export `bootstrapWorkflowBundle` must be a function")
  }
  await (bootstrap as WorkflowBundleBootstrap)(ctx)
}

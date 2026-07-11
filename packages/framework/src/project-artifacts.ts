import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

import type { ResolvedProjectArtifacts } from "./project-resolver.js"

export type ProjectArtifactWriteMode = "write" | "check"

export type ProjectArtifactWriteStatus = "written" | "unchanged" | "missing" | "stale"

export interface WriteProjectArtifactsInput {
  projectRoot: string
  artifacts: ResolvedProjectArtifacts
  mode?: ProjectArtifactWriteMode
}

export interface ProjectArtifactWriteEntry {
  /** Path relative to `<projectRoot>/.voyant`. */
  path: string
  status: ProjectArtifactWriteStatus
}

export interface ProjectArtifactWriteResult {
  mode: ProjectArtifactWriteMode
  outputRoot: string
  /** Whether every artifact matched after the requested operation. */
  ok: boolean
  files: readonly ProjectArtifactWriteEntry[]
}

interface ValidatedArtifact {
  path: string
  segments: readonly string[]
  contents: string
}

let temporaryFileSequence = 0

/**
 * Materialize resolver output beneath `<projectRoot>/.voyant`, or check it for staleness.
 * Artifact paths are treated as portable paths and cannot be absolute, escape the output
 * directory, alias another artifact, or traverse symbolic links.
 */
export async function writeProjectArtifacts(
  input: WriteProjectArtifactsInput,
): Promise<ProjectArtifactWriteResult> {
  const mode = input.mode ?? "write"
  if (mode !== "write" && mode !== "check") {
    throw new TypeError(`Unsupported project artifact write mode: ${String(mode)}`)
  }
  if (typeof input.projectRoot !== "string" || input.projectRoot.length === 0) {
    throw new TypeError("projectRoot must be a non-empty string")
  }

  const projectRoot = path.resolve(input.projectRoot)
  const outputRoot = path.join(projectRoot, ".voyant")
  const files = validateArtifacts(input.artifacts)

  await preflightOutputTree(outputRoot, files)
  if (mode === "write") await ensureOutputDirectories(outputRoot, files)

  const results: ProjectArtifactWriteEntry[] = []
  for (const file of files) {
    const target = path.join(outputRoot, ...file.segments)
    const actual = await readTextIfFile(target)

    if (actual === file.contents) {
      results.push({ path: file.path, status: "unchanged" })
      continue
    }
    if (mode === "check") {
      results.push({ path: file.path, status: actual === undefined ? "missing" : "stale" })
      continue
    }

    await atomicWriteFile(target, file.contents)
    results.push({ path: file.path, status: "written" })
  }

  return {
    mode,
    outputRoot,
    ok: mode === "write" || results.every((file) => file.status === "unchanged"),
    files: results,
  }
}

function validateArtifacts(artifacts: ResolvedProjectArtifacts): ValidatedArtifact[] {
  if (!artifacts || !Array.isArray(artifacts.files)) {
    throw new TypeError("artifacts.files must be an array")
  }

  validatePortablePath(artifacts.runtimeEntry, "artifacts.runtimeEntry")
  validatePortablePath(artifacts.workflowRuntimeEntry, "artifacts.workflowRuntimeEntry")
  validatePortablePath(artifacts.migrationRunner, "artifacts.migrationRunner")

  const seen = new Map<string, string>()
  const files = artifacts.files.map((file, index) => {
    if (!file || typeof file.contents !== "string") {
      throw new TypeError(`artifacts.files[${index}].contents must be a string`)
    }
    const segments = validatePortablePath(file.path, `artifacts.files[${index}].path`)
    const portablePath = segments.join("/")
    const duplicateKey = portablePath.toLocaleLowerCase("en-US")
    const duplicate = seen.get(duplicateKey)
    if (duplicate !== undefined) {
      throw new TypeError(`Duplicate project artifact paths: ${duplicate} and ${file.path}`)
    }
    seen.set(duplicateKey, file.path)
    return { path: portablePath, segments, contents: file.contents }
  })

  return files.sort((left, right) => compareText(left.path, right.path))
}

function validatePortablePath(value: unknown, label: string): string[] {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new TypeError(`${label} must be a non-empty artifact path`)
  }
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
    throw new TypeError(`${label} must be relative to the .voyant directory: ${value}`)
  }

  const segments = value.replaceAll("\\", "/").split("/")
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new TypeError(
      `${label} must not escape or alias a path in the .voyant directory: ${value}`,
    )
  }
  return segments
}

async function preflightOutputTree(
  outputRoot: string,
  files: readonly ValidatedArtifact[],
): Promise<void> {
  await inspectPathComponent(outputRoot, "directory")
  for (const file of files) {
    let current = outputRoot
    for (const segment of file.segments.slice(0, -1)) {
      current = path.join(current, segment)
      const state = await inspectPathComponent(current, "directory")
      if (state === "missing") break
    }
    await inspectPathComponent(path.join(outputRoot, ...file.segments), "file")
  }
}

async function ensureOutputDirectories(
  outputRoot: string,
  files: readonly ValidatedArtifact[],
): Promise<void> {
  await mkdir(outputRoot, { recursive: true })
  await inspectPathComponent(outputRoot, "directory")
  for (const file of files) {
    let current = outputRoot
    for (const segment of file.segments.slice(0, -1)) {
      current = path.join(current, segment)
      await mkdir(current).catch((error: unknown) => {
        if (!isNodeError(error, "EEXIST")) throw error
      })
      await inspectPathComponent(current, "directory")
    }
  }
}

async function inspectPathComponent(
  candidate: string,
  expected: "directory" | "file",
): Promise<"present" | "missing"> {
  try {
    const stats = await lstat(candidate)
    if (stats.isSymbolicLink()) {
      throw new Error(`Project artifact path traverses a symbolic link: ${candidate}`)
    }
    const valid = expected === "directory" ? stats.isDirectory() : stats.isFile()
    if (!valid) throw new Error(`Project artifact path is not a ${expected}: ${candidate}`)
    return "present"
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return "missing"
    throw error
  }
}

async function readTextIfFile(filePath: string): Promise<string | undefined> {
  try {
    return await readFile(filePath, "utf8")
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return undefined
    throw error
  }
}

async function atomicWriteFile(filePath: string, contents: string): Promise<void> {
  temporaryFileSequence += 1
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${temporaryFileSequence}.tmp`,
  )
  let temporaryFileCreated = false
  try {
    await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" })
    temporaryFileCreated = true
    await rename(temporaryPath, filePath)
    temporaryFileCreated = false
  } finally {
    if (temporaryFileCreated) await rm(temporaryPath, { force: true })
  }
}

function isNodeError(error: unknown, code: string): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error && error.code === code
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

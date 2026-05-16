#!/usr/bin/env tsx
/**
 * Builds all Voyant shadcn registry packages and aggregates their JSON
 * payloads into `apps/registry/public/r/`.
 *
 * Discovery: finds every package-level `registry.json` file, runs `shadcn build`
 * inside that directory, then copies the generated JSON files into the
 * registry host's public assets.
 */

import { execSync } from "node:child_process"
import { readdirSync, readFileSync, rmSync, statSync } from "node:fs"
import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, "..")
const packagesDir = join(repoRoot, "packages")
const registryHostPublic = join(repoRoot, "apps/registry/public/r")
const shadcnVersion = "4.1.2"

function findRegistryPackages(): string[] {
  const entries = readdirSync(packagesDir)
  return entries
    .map((name) => join(packagesDir, name))
    .filter((path) => {
      try {
        return statSync(join(path, "registry.json")).isFile()
      } catch {
        return false
      }
    })
}

function buildPackage(packageDir: string): string {
  const manifestPath = join(packageDir, "registry.json")
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name: string }
  console.log(`[registry] building ${manifest.name} in ${packageDir}`)

  rmSync(join(packageDir, "public/r"), { recursive: true, force: true })

  // shadcn build reads ./registry.json and writes to ./public/r/
  execSync(`pnpm dlx shadcn@${shadcnVersion} build`, {
    cwd: packageDir,
    stdio: "inherit",
  })

  return join(packageDir, "public/r")
}

async function aggregateOutputs(outputDirs: string[]): Promise<void> {
  await rm(registryHostPublic, { recursive: true, force: true })
  await mkdir(registryHostPublic, { recursive: true })

  const aggregated: string[] = []
  for (const dir of outputDirs) {
    let files: string[]
    try {
      files = await readdir(dir)
    } catch {
      console.warn(`[registry] no output at ${dir}, skipping`)
      continue
    }
    for (const file of files) {
      if (!file.endsWith(".json")) continue
      await cp(join(dir, file), join(registryHostPublic, file))
      aggregated.push(file.replace(/\.json$/, ""))
    }
  }

  const index = {
    name: "voyant",
    description: "Voyant shadcn registry index",
    items: aggregated.sort(),
  }
  await writeFile(join(registryHostPublic, "registry.json"), `${JSON.stringify(index, null, 2)}\n`)

  console.log(`[registry] aggregated ${aggregated.length} items into ${registryHostPublic}`)
}

async function main(): Promise<void> {
  const packages = findRegistryPackages()
  if (packages.length === 0) {
    console.log("[registry] no registry packages found")
    return
  }
  const outputs = packages.map(buildPackage)
  await aggregateOutputs(outputs)
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})

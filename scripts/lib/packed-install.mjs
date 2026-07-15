import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export function createPackedInstallManifest(packedPackages) {
  const dependencies = Object.fromEntries(
    [...packedPackages]
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, tarballPath }) => [name, `file:${path.resolve(tarballPath)}`]),
  )

  return {
    name: "voyant-packed-install-verification",
    version: "0.0.0",
    private: true,
    dependencies,
  }
}

export async function verifyPackedPackageInstall(packedPackages) {
  if (packedPackages.length === 0) return

  const installDir = fs.mkdtempSync(path.join(os.tmpdir(), "voyant-packed-install-"))
  try {
    const manifest = createPackedInstallManifest(packedPackages)
    fs.writeFileSync(
      path.join(installDir, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    )

    await execFileAsync(
      "npm",
      ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund"],
      {
        cwd: installDir,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        env: process.env,
      },
    )
  } catch (error) {
    const detail =
      error.stderr?.toString().trim() || error.stdout?.toString().trim() || error.message
    throw new Error(`npm could not resolve the packed public dependency tree: ${detail}`)
  } finally {
    fs.rmSync(installDir, { recursive: true, force: true })
  }
}

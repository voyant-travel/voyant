import { execFile } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import semver from "semver"

const execFileAsync = promisify(execFile)

export function collectStagedPeerInstallExclusions(packedPackages, projectedVersions) {
  const packedVersions = new Map(
    packedPackages.map(({ manifest }) => [manifest.name, manifest.version]),
  )
  const exclusions = new Set()

  for (const { manifest } of packedPackages) {
    for (const [peerName, peerRange] of Object.entries(manifest.peerDependencies ?? {})) {
      const packedPeerVersion = packedVersions.get(peerName)
      if (!packedPeerVersion || semver.satisfies(packedPeerVersion, peerRange)) continue

      const projectedPeerVersion = projectedVersions.get(peerName)
      const projectedConsumerVersion = projectedVersions.get(manifest.name)
      if (
        !projectedConsumerVersion ||
        !projectedPeerVersion ||
        !semver.satisfies(projectedPeerVersion, peerRange)
      ) {
        throw new Error(
          `Packed peer mismatch is not covered by the release plan: ${manifest.name}@${manifest.version} requires ${peerName}@${peerRange}, packed ${packedPeerVersion}, projected ${projectedPeerVersion ?? "unreleased"}`,
        )
      }

      exclusions.add(manifest.name)
    }
  }

  return exclusions
}

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

import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  loadRemoteWorkspaceAdapters,
  remoteWorkspaceAdapterConfigPath,
  resolveRemoteWorkspaceAdapter,
  unsupportedRemoteWorkspaceAdapter,
} from "../lib/agent-runner-remote-workspace.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"

describe("agent runner remote workspace adapters", () => {
  it("reports unsupported remote providers without enabling execution", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const unsupported = unsupportedRemoteWorkspaceAdapter(descriptor)

    assert.deepEqual(await unsupported.inspect(), {
      availableProviders: [],
      capabilities: {
        inspect: true,
        exec: false,
        spawn: false,
        exposeHttp: false,
        collectArtifacts: false,
        dispose: false,
      },
      id: "task-579",
      kind: "remote-sandbox",
      provider: "sprite",
      ready: false,
      reason: "remote workspace provider sprite is not configured",
      reference: "sandbox:sprite:task-579",
    })
    await assert.rejects(() => unsupported.exec(), /exec is unavailable/)
  })

  it("normalizes registered remote workspace adapters", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const registered = resolveRemoteWorkspaceAdapter(descriptor, {
      adapters: {
        sprite: (workspace) => ({
          ...workspace,
          capabilities: { inspect: true, exec: true },
          ready: true,
          async inspect() {
            return { ready: true, reference: workspace.reference }
          },
          async exec(command) {
            return { command, status: 0 }
          },
        }),
      },
    })

    assert.equal(registered.ready, true)
    assert.equal(registered.capabilities.exec, true)
    assert.equal(registered.capabilities.spawn, false)
    assert.deepEqual(await registered.exec(["pnpm", "test"]), {
      command: ["pnpm", "test"],
      status: 0,
    })
  })

  it("loads remote workspace adapters from an explicit config module", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-remote-workspace-"))
    const configPath = path.join(tempDir, "remote-workspaces.mjs")
    writeFileSync(
      configPath,
      `
export function remoteWorkspaceAdapters({ env, repoRoot }) {
  return {
    sprite: (workspace) => ({
      ...workspace,
      capabilities: { inspect: true, exec: true },
      ready: Boolean(env.TEST_REMOTE_TOKEN),
      async inspect() {
        return { ready: this.ready, reference: this.reference, repoRoot }
      },
      async exec(command) {
        return { command, status: 0 }
      },
    }),
  }
}
`,
    )

    try {
      const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
      const adapters = await loadRemoteWorkspaceAdapters({
        configPath,
        env: { TEST_REMOTE_TOKEN: "token" },
        repoRoot: "/repo",
      })
      const adapter = resolveRemoteWorkspaceAdapter(descriptor, { adapters })

      assert.equal(adapter.ready, true)
      assert.equal(adapter.capabilities.exec, true)
      assert.deepEqual(await adapter.inspect(), {
        ready: true,
        reference: "sandbox:sprite:task-579",
        repoRoot: "/repo",
      })
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("uses a default adapter config only when the repo config exists", () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-remote-workspace-"))

    try {
      assert.equal(remoteWorkspaceAdapterConfigPath({ repoRoot: tempDir }), null)

      const configDir = path.join(tempDir, ".agents")
      const configPath = path.join(configDir, "remote-workspaces.mjs")
      mkdirSync(configDir)
      writeFileSync(configPath, "export default {}\n")
      assert.equal(remoteWorkspaceAdapterConfigPath({ repoRoot: tempDir }), configPath)
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("rejects malformed adapter config exports", async () => {
    const tempDir = mkdtempSync(path.join(tmpdir(), "agent-remote-workspace-"))
    const configPath = path.join(tempDir, "remote-workspaces.mjs")
    writeFileSync(configPath, "export default { Sprite: {} }\n")

    try {
      await assert.rejects(
        () => loadRemoteWorkspaceAdapters({ configPath, repoRoot: "/repo" }),
        /remote workspace adapter provider is invalid: Sprite/,
      )
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("rejects invalid and local workspace references", () => {
    assert.throws(
      () =>
        resolveRemoteWorkspaceAdapter(
          parseWorkspaceReference("sandbox:Sprite:task-579", { repoRoot: "/repo" }),
        ),
      /invalid remote workspace reference: remote sandbox reference is malformed/,
    )

    assert.throws(
      () =>
        resolveRemoteWorkspaceAdapter(
          parseWorkspaceReference(".agent-worktrees/task-579", { repoRoot: "/repo" }),
        ),
      /remote workspace adapter requires a remote-sandbox reference; got local-worktree/,
    )
  })
})

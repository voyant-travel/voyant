import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
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

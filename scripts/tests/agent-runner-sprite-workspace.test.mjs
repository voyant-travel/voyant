import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  spriteCliRemoteWorkspaceAdapter,
  spriteExecPlan,
} from "../lib/agent-runner-sprite-workspace.mjs"
import { parseWorkspaceReference } from "../lib/agent-runner-workspace-contract.mjs"

describe("agent runner sprite workspace adapter", () => {
  it("plans non-interactive CLI exec commands", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })

    assert.deepEqual(
      spriteExecPlan(
        descriptor,
        {
          args: ["verify:fast"],
          command: "pnpm",
          cwd: "/workspace/voyant",
          env: { CI: "1" },
        },
        { env: { SPRITE_ORG: "voyant" } },
      ),
      {
        args: [
          "exec",
          "--sprite",
          "task-579",
          "--org",
          "voyant",
          "--dir",
          "/workspace/voyant",
          "--env",
          "CI=1",
          "--http-post",
          "pnpm",
          "verify:fast",
        ],
        displayCommand: "pnpm verify:fast",
        env: { CI: "1", SPRITE_ORG: "voyant" },
      },
    )
  })

  it("wraps shell command strings for remote execution", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })

    assert.deepEqual(spriteExecPlan(descriptor, "pnpm test", { env: {} }), {
      args: ["exec", "--sprite", "task-579", "--http-post", "bash", "-lc", "pnpm test"],
      displayCommand: "bash -lc pnpm test",
      env: {},
    })
  })

  it("executes through an injected CLI process", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const calls = []
    const adapter = spriteCliRemoteWorkspaceAdapter(descriptor, {
      cli: "sprite",
      env: { SPRITE_ORG: "voyant" },
      runProcess(command, args, options) {
        calls.push({ args, command, env: options.env })
        return { status: 0, stderr: "", stdout: "ok" }
      },
    })

    assert.deepEqual(await adapter.exec({ args: ["test"], command: "pnpm" }), {
      command: "pnpm test",
      signal: null,
      status: 0,
      stderr: "",
      stdout: "ok",
    })
    assert.deepEqual(calls, [
      {
        args: ["exec", "--sprite", "task-579", "--org", "voyant", "--http-post", "pnpm", "test"],
        command: "sprite",
        env: { SPRITE_ORG: "voyant" },
      },
    ])
  })

  it("treats signaled CLI execution as failed", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const adapter = spriteCliRemoteWorkspaceAdapter(descriptor, {
      runProcess() {
        return { signal: "SIGTERM", status: null, stderr: "terminated", stdout: "" }
      },
    })

    assert.deepEqual(await adapter.exec("pnpm test"), {
      command: "bash -lc pnpm test",
      signal: "SIGTERM",
      status: 1,
      stderr: "terminated",
      stdout: "",
    })
  })

  it("reports unavailable CLI during inspect", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const adapter = spriteCliRemoteWorkspaceAdapter(descriptor, {
      runProcess() {
        return { error: new Error("not found"), status: null, stderr: "", stdout: "" }
      },
    })

    assert.deepEqual(await adapter.inspect(), {
      capabilities: {
        inspect: true,
        exec: true,
        spawn: false,
        exposeHttp: false,
        collectArtifacts: false,
        dispose: false,
      },
      cli: "sprite",
      id: "task-579",
      kind: "remote-sandbox",
      provider: "sprite",
      ready: false,
      reason: "not found",
      reference: "sandbox:sprite:task-579",
    })
  })
})

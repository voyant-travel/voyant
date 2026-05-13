import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  parseSpritePool,
  resolveSpriteTarget,
  spriteApiExecPlan,
  spriteApiRemoteWorkspaceAdapter,
  spriteCliRemoteWorkspaceAdapter,
  spriteExecPlan,
  spriteRemoteWorkspaceAdapter,
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

  it("plans API exec query parameters", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const plan = spriteApiExecPlan(
      descriptor,
      {
        args: ["verify:fast"],
        command: "pnpm",
        cwd: "/workspace/voyant",
        env: { CI: "1" },
      },
      { env: { SPRITE_ORG: "voyant" } },
    )

    assert.equal(plan.displayCommand, "pnpm verify:fast")
    assert.deepEqual(plan.env, { CI: "1", SPRITE_ORG: "voyant" })
    assert.deepEqual(Array.from(plan.query.entries()), [
      ["cmd", "pnpm"],
      ["cmd", "verify:fast"],
      ["dir", "/workspace/voyant"],
      ["env", "CI=1"],
    ])
  })

  it("maps pooled Sprite slot references to the backing Sprite name", () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:voyant-agent-01-slot-2", {
      repoRoot: "/repo",
    })

    assert.deepEqual(parseSpritePool("voyant-agent-01:2,voyant-agent-02:1"), [
      {
        id: "voyant-agent-01-slot-1",
        slot: 1,
        sprite: "voyant-agent-01",
        workspaceReference: "sandbox:sprite:voyant-agent-01-slot-1",
      },
      {
        id: "voyant-agent-01-slot-2",
        slot: 2,
        sprite: "voyant-agent-01",
        workspaceReference: "sandbox:sprite:voyant-agent-01-slot-2",
      },
      {
        id: "voyant-agent-02",
        slot: 1,
        sprite: "voyant-agent-02",
        workspaceReference: "sandbox:sprite:voyant-agent-02",
      },
    ])
    assert.deepEqual(
      resolveSpriteTarget(descriptor, { env: { AGENT_SPRITE_POOL: "voyant-agent-01:2" } }),
      {
        id: "voyant-agent-01-slot-2",
        slot: 2,
        sprite: "voyant-agent-01",
      },
    )
  })

  it("inspects and executes through the Sprite API when a token is configured", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const calls = []
    const adapter = spriteApiRemoteWorkspaceAdapter(descriptor, {
      env: { SPRITES_TOKEN: "token" },
      fetchImpl: async (url, init) => {
        calls.push({ headers: init.headers, method: init.method, url: String(url) })
        if (init.method === "GET") {
          return jsonResponse({ name: "task-579", status: "running" })
        }

        return jsonResponse({
          exit_code: 2,
          stderr: "bad",
          stdout: "out",
        })
      },
    })

    assert.deepEqual(await adapter.inspect(), {
      apiUrl: "https://api.sprites.dev",
      capabilities: {
        inspect: true,
        exec: true,
        spawn: false,
        exposeHttp: false,
        collectArtifacts: false,
        dispose: true,
      },
      id: "task-579",
      kind: "remote-sandbox",
      provider: "sprite",
      ready: true,
      reason: null,
      reference: "sandbox:sprite:task-579",
      slot: null,
      sprite: { name: "task-579", status: "running" },
      spriteName: "task-579",
    })
    assert.deepEqual(await adapter.exec({ args: ["test"], command: "pnpm" }), {
      command: "pnpm test",
      signal: null,
      status: 2,
      stderr: "bad",
      stdout: "out",
    })
    assert.deepEqual(calls, [
      {
        headers: { authorization: "Bearer token" },
        method: "GET",
        url: "https://api.sprites.dev/v1/sprites/task-579",
      },
      {
        headers: { authorization: "Bearer token" },
        method: "POST",
        url: "https://api.sprites.dev/v1/sprites/task-579/exec?cmd=pnpm&cmd=test",
      },
    ])
  })

  it("parses API exec NDJSON output", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const adapter = spriteApiRemoteWorkspaceAdapter(descriptor, {
      env: { SPRITES_TOKEN: "token" },
      fetchImpl: async () =>
        new Response(
          [
            JSON.stringify({ data: "hello", type: "stdout" }),
            JSON.stringify({ data: "warning", type: "stderr" }),
            JSON.stringify({ exit_code: 7, type: "exit" }),
          ].join("\n"),
          { status: 200 },
        ),
    })

    assert.deepEqual(await adapter.exec("pnpm test"), {
      command: "bash -lc pnpm test",
      signal: null,
      status: 7,
      stderr: "warning",
      stdout: "hello",
    })
  })

  it("disposes through the Sprite API", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const calls = []
    const adapter = spriteApiRemoteWorkspaceAdapter(descriptor, {
      env: { SPRITES_TOKEN: "token" },
      fetchImpl: async (url, init) => {
        calls.push({ method: init.method, url: String(url) })
        return new Response(null, { status: 204 })
      },
    })

    assert.deepEqual(await adapter.dispose(), {
      disposed: true,
      spriteName: "task-579",
      status: 204,
    })
    assert.deepEqual(calls, [
      {
        method: "DELETE",
        url: "https://api.sprites.dev/v1/sprites/task-579",
      },
    ])
  })

  it("falls back to the CLI adapter when no API token is configured", async () => {
    const descriptor = parseWorkspaceReference("sandbox:sprite:task-579", { repoRoot: "/repo" })
    const adapter = spriteRemoteWorkspaceAdapter(descriptor, {
      runProcess() {
        return { error: new Error("not found"), status: null, stderr: "", stdout: "" }
      },
    })

    assert.equal(adapter.capabilities.dispose, false)
    assert.equal((await adapter.inspect()).reason, "not found")
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

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200,
    ...init,
  })
}

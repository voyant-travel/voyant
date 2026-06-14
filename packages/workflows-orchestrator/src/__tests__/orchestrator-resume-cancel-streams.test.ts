import { workflow } from "@voyant-travel/workflows"
import { describe, expect, it } from "vitest"
import { cancel, createInMemoryRunStore, resume, trigger } from "../index.js"
import { handler, tenantMeta } from "./orchestrator-test-support.js"

describe("resume()", () => {
  it("resolves a parked run when a matching event is injected", async () => {
    workflow<void, { greeting: string }>({
      id: "greet",
      async run(_i, ctx) {
        const e = await ctx.waitForEvent<{ name: string }>("greet")
        return { greeting: `hello ${e!.name}` }
      },
    })
    const store = createInMemoryRunStore()
    const parked = await trigger(
      { workflowId: "greet", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(parked.status).toBe("waiting")

    const out = await resume(
      {
        runId: parked.id,
        injection: { kind: "EVENT", eventType: "greet", payload: { name: "ada" } },
      },
      { store, handler },
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.record.status).toBe("completed")
      expect(out.record.output).toEqual({ greeting: "hello ada" })
    }
  })

  it("returns not_found for unknown run ids", async () => {
    const store = createInMemoryRunStore()
    const out = await resume(
      { runId: "run_ghost", injection: { kind: "EVENT", eventType: "x" } },
      { store, handler },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.status).toBe("not_found")
  })

  it("returns not_parked for terminal runs", async () => {
    workflow<void, number>({
      id: "done",
      async run() {
        return 1
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "done", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    const out = await resume(
      { runId: rec.id, injection: { kind: "EVENT", eventType: "x" } },
      { store, handler },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.status).toBe("not_parked")
  })

  it("returns no_match when the injection doesn't match a pending waitpoint", async () => {
    workflow<void, unknown>({
      id: "wait",
      async run(_i, ctx) {
        return await ctx.waitForEvent("expected")
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "wait", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    const out = await resume(
      { runId: rec.id, injection: { kind: "EVENT", eventType: "unexpected" } },
      { store, handler },
    )
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.status).toBe("no_match")
  })

  it("parks again on the next waitpoint in a chained run", async () => {
    workflow<void, unknown>({
      id: "chain-wait",
      async run(_i, ctx) {
        const a = await ctx.waitForEvent<{ v: number }>("first")
        const b = await ctx.waitForEvent<{ v: number }>("second")
        return { sum: a!.v + b!.v }
      },
    })
    const store = createInMemoryRunStore()
    const parked1 = await trigger(
      { workflowId: "chain-wait", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(parked1.pendingWaitpoints[0]!.meta.eventType).toBe("first")

    const mid = await resume(
      { runId: parked1.id, injection: { kind: "EVENT", eventType: "first", payload: { v: 3 } } },
      { store, handler },
    )
    expect(mid.ok).toBe(true)
    if (mid.ok) {
      expect(mid.record.status).toBe("waiting")
      expect(mid.record.pendingWaitpoints[0]!.meta.eventType).toBe("second")
    }

    const done = await resume(
      { runId: parked1.id, injection: { kind: "EVENT", eventType: "second", payload: { v: 4 } } },
      { store, handler },
    )
    expect(done.ok).toBe(true)
    if (done.ok) {
      expect(done.record.status).toBe("completed")
      expect(done.record.output).toEqual({ sum: 7 })
    }
  })
})

describe("cancel()", () => {
  it("flips a parked run to cancelled", async () => {
    workflow<void, unknown>({
      id: "wait",
      async run(_i, ctx) {
        return await ctx.waitForEvent("never")
      },
    })
    const store = createInMemoryRunStore()
    const parked = await trigger(
      { workflowId: "wait", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    const out = await cancel({ runId: parked.id, reason: "user requested" }, { store, handler })
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.record.status).toBe("cancelled")
      expect(out.record.error?.message).toBe("user requested")
      expect(out.record.pendingWaitpoints).toEqual([])
    }
  })

  it("rejects cancel for terminal runs", async () => {
    workflow<void, number>({
      id: "done",
      async run() {
        return 1
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "done", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    const out = await cancel({ runId: rec.id }, { store, handler })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.status).toBe("already_terminal")
  })

  it("returns not_found for unknown runs", async () => {
    const store = createInMemoryRunStore()
    const out = await cancel({ runId: "ghost" }, { store, handler })
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.status).toBe("not_found")
  })
})

describe("streams", () => {
  it("accumulates ctx.stream.text chunks on RunRecord.streams", async () => {
    workflow<void, "ok">({
      id: "stream-text",
      async run(_i, ctx) {
        await ctx.stream.text(
          "transcript",
          (async function* () {
            yield "Hello"
            yield ", "
            yield "world"
          })(),
        )
        return "ok"
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "stream-text", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(rec.status).toBe("completed")
    const chunks = rec.streams.transcript ?? []
    // 3 data chunks + 1 final marker (chunk: null, final: true).
    expect(chunks.length).toBeGreaterThanOrEqual(3)
    const payloads = chunks.filter((c) => !c.final).map((c) => c.chunk)
    expect(payloads).toEqual(["Hello", ", ", "world"])
    expect(chunks[chunks.length - 1]!.final).toBe(true)
    // Sequence numbers are monotonically increasing.
    const seqs = chunks.map((c) => c.seq)
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b))
  })

  it("accumulates chunks across a park/resume boundary", async () => {
    workflow<void, "done">({
      id: "stream-across-wait",
      async run(_i, ctx) {
        await ctx.stream.text(
          "log",
          (async function* () {
            yield "phase-1-chunk-a"
            yield "phase-1-chunk-b"
          })(),
        )
        await ctx.waitForEvent("go")
        await ctx.stream.text(
          "log-2",
          (async function* () {
            yield "phase-2-chunk-a"
          })(),
        )
        return "done"
      },
    })
    const store = createInMemoryRunStore()
    const parked = await trigger(
      { workflowId: "stream-across-wait", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    expect(parked.status).toBe("waiting")
    // Phase 1 chunks are already on the record.
    const phase1 = parked.streams.log!.filter((c) => !c.final).map((c) => c.chunk)
    expect(phase1).toEqual(["phase-1-chunk-a", "phase-1-chunk-b"])
    expect(parked.streams["log-2"]).toBeUndefined()

    const out = await resume(
      { runId: parked.id, injection: { kind: "EVENT", eventType: "go" } },
      { store, handler },
    )
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.record.status).toBe("completed")
      // Phase 1 stream preserved; phase 2 stream added.
      const preserved = out.record.streams.log!.filter((c) => !c.final).map((c) => c.chunk)
      expect(preserved).toEqual(["phase-1-chunk-a", "phase-1-chunk-b"])
      const phase2 = out.record.streams["log-2"]!.filter((c) => !c.final).map((c) => c.chunk)
      expect(phase2).toEqual(["phase-2-chunk-a"])
    }
  })

  it("fires onStreamChunk live as the generator emits, not only at end", async () => {
    workflow<void, "ok">({
      id: "stream-live",
      async run(_i, ctx) {
        await ctx.stream.text(
          "log",
          (async function* () {
            yield "chunk-1"
            yield "chunk-2"
            yield "chunk-3"
          })(),
        )
        return "ok"
      },
    })
    const store = createInMemoryRunStore()
    const observed: string[] = []
    await trigger(
      { workflowId: "stream-live", workflowVersion: "v1", input: undefined, tenantMeta },
      {
        store,
        handler,
        onStreamChunk: (chunk) => {
          if (!chunk.final && typeof chunk.chunk === "string") {
            observed.push(chunk.chunk)
          }
        },
      },
    )
    expect(observed).toEqual(["chunk-1", "chunk-2", "chunk-3"])
  })

  it("persists streams through the in-memory store's structuredClone round-trip", async () => {
    workflow<void, "ok">({
      id: "stream-persist",
      async run(_i, ctx) {
        await ctx.stream.json(
          "events",
          (async function* () {
            yield { kind: "start" }
            yield { kind: "finish", at: 42 }
          })(),
        )
        return "ok"
      },
    })
    const store = createInMemoryRunStore()
    const rec = await trigger(
      { workflowId: "stream-persist", workflowVersion: "v1", input: undefined, tenantMeta },
      { store, handler },
    )
    // Read it back — the in-memory store structuredClones on save + get.
    const fromStore = await store.get(rec.id)
    expect(fromStore).toBeDefined()
    const chunks = fromStore!.streams.events!.filter((c) => !c.final)
    expect(chunks.map((c) => c.chunk)).toEqual([{ kind: "start" }, { kind: "finish", at: 42 }])
    expect(chunks.every((c) => c.encoding === "json")).toBe(true)
  })
})

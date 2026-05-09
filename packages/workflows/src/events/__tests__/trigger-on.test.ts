// trigger.on() runtime collector — exercises the SDK-facing API end-to-end:
// declare a workflow, call trigger.on(), inspect the registry.

import { afterEach, describe, expect, test } from "vitest"

import { __resetRegistry, workflow } from "../../index.js"
import { trigger } from "../../trigger.js"
import { EventFilterCompileError } from "../compile.js"
import { __resetEventFilterRegistry, getEventFilterRegistry } from "../registry.js"

afterEach(() => {
  __resetRegistry()
  __resetEventFilterRegistry()
})

describe("trigger.on", () => {
  test("registers a filter and returns the runtime entry", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-target",
      async run() {},
    })

    const entry = trigger.on<{ kind: string }>("promotion.changed", {
      target: wf,
      where: { eq: [{ path: "data.kind" }, { lit: "all" }] },
    })

    // The returned entry is the same EventFilterRuntimeEntry that lands
    // in the registry — directly droppable into Module.eventFilters
    // without a registry lookup.
    expect(entry.eventType).toBe("promotion.changed")
    expect(entry.id).toMatch(/^ef_[0-9a-f]{16}$/)
    expect(entry.targetWorkflowId).toBe("test-target")
    expect(entry.manifest.eventType).toBe("promotion.changed")
    expect(entry.manifest.id).toBe(entry.id)

    const entries = getEventFilterRegistry().list()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toBe(entry)
  })

  test("identical declarations produce identical ids (stable across re-imports)", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-stable",
      async run() {},
    })

    const a = trigger.on("evt.x", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v" }] },
    })
    const b = trigger.on("evt.x", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v" }] },
    })

    expect(a.id).toBe(b.id)
    // Re-registering the same id is idempotent.
    expect(getEventFilterRegistry().list()).toHaveLength(1)
  })

  test("differing where clauses produce different ids", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-diff",
      async run() {},
    })

    const a = trigger.on("evt.x", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v1" }] },
    })
    const b = trigger.on("evt.x", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v2" }] },
    })

    expect(a.id).not.toBe(b.id)
    expect(getEventFilterRegistry().list()).toHaveLength(2)
  })

  test("filter without where or input is allowed (always-fire)", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-bare",
      async run() {},
    })

    const entry = trigger.on("evt.x", { target: wf })
    expect(entry.eventType).toBe("evt.x")
    expect(entry.manifest.where).toBeUndefined()
    expect(entry.manifest.input).toBeUndefined()
  })

  test("rejects empty event name", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-empty-event",
      async run() {},
    })
    expect(() => trigger.on("", { target: wf })).toThrow(EventFilterCompileError)
  })

  test("rejects target without id", () => {
    expect(() => trigger.on("evt.x", { target: {} as never })).toThrow(EventFilterCompileError)
  })

  test("rejects legacy match callback explicitly", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-legacy-match",
      async run() {},
    })
    expect(() =>
      trigger.on("evt.x", {
        target: wf,
        match: () => true,
      } as never),
    ).toThrow(/match.*callback is no longer supported/)
  })

  test("rejects malformed where clause at registration", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-bad-where",
      async run() {},
    })
    let err: unknown
    try {
      trigger.on("evt.x", {
        target: wf,
        where: { eq: [{ path: "rogue.x" }, { lit: "v" }] },
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(EventFilterCompileError)
    expect((err as EventFilterCompileError).errors[0]).toMatch(/path root "rogue"/)
  })

  test("rejects malformed input mapper at registration", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-bad-input",
      async run() {},
    })
    expect(() =>
      trigger.on("evt.x", {
        target: wf,
        input: { object: { x: { path: "rogue.y" } } },
      }),
    ).toThrow(EventFilterCompileError)
  })

  test("manifest entry mirrors the declaration shape", () => {
    const wf = workflow<{ x: number }, void>({
      id: "test-manifest-shape",
      async run() {},
    })

    const entry = trigger.on("evt.x", {
      target: wf,
      where: { eq: [{ path: "data.k" }, { lit: "v" }] },
      input: {
        object: {
          k: { path: "data.k" },
          marker: { lit: "evt.x" },
        },
      },
    })

    expect(entry.manifest).toMatchObject({
      id: entry.id,
      eventType: "evt.x",
      targetWorkflowId: "test-manifest-shape",
      where: { eq: [{ path: "data.k" }, { lit: "v" }] },
      input: {
        object: {
          k: { path: "data.k" },
          marker: { lit: "evt.x" },
        },
      },
    })
    expect(entry?.manifest.payloadHash).toMatch(/^[0-9a-f]{16}$/)
  })
})

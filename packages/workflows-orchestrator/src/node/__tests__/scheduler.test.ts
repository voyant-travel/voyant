import { describe, expect, it } from "vitest"
import { computeNextFire, createScheduler, nextCronFire, parseCron, toMs } from "../scheduler.js"

describe("toMs", () => {
  it("passes numbers through", () => {
    expect(toMs(500)).toBe(500)
  })

  it("parses common units", () => {
    expect(toMs("250ms")).toBe(250)
    expect(toMs("5s")).toBe(5_000)
    expect(toMs("2m")).toBe(120_000)
    expect(toMs("1h")).toBe(3_600_000)
    expect(toMs("1d")).toBe(86_400_000)
    expect(toMs("1w")).toBe(604_800_000)
  })

  it("rejects junk", () => {
    expect(() => toMs("bad" as "1s")).toThrow(/invalid duration/)
  })
})

describe("parseCron", () => {
  it("accepts a 5-field literal expression", () => {
    const spec = parseCron("30 8 1 1 0")
    expect(spec.minute).toEqual([30])
    expect(spec.hour).toEqual([8])
    expect(spec.day).toEqual([1])
    expect(spec.month).toEqual([1])
    expect(spec.dow).toEqual([0])
  })

  it("expands wildcards and ranges", () => {
    expect(parseCron("*/15 * * * *").minute).toEqual([0, 15, 30, 45])
    expect(parseCron("0 9-11,14 * * 1-5").hour).toEqual([9, 10, 11, 14])
  })

  it("rejects invalid field counts and ranges", () => {
    expect(() => parseCron("* * *")).toThrow(/5 fields/)
    expect(() => parseCron("60 * * * *")).toThrow(/minute/)
    expect(() => parseCron("* 24 * * *")).toThrow(/hour/)
  })
})

describe("nextCronFire", () => {
  it("finds the next matching minute", () => {
    const spec = parseCron("*/5 * * * *")
    const from = Date.UTC(2026, 3, 17, 10, 2, 13)
    const next = nextCronFire(spec, from)
    expect(new Date(next).toISOString()).toBe("2026-04-17T10:05:00.000Z")
  })

  it("advances to the next day when the current slot already passed", () => {
    const spec = parseCron("0 9 * * *")
    const from = Date.UTC(2026, 3, 17, 10, 0)
    const next = nextCronFire(spec, from)
    expect(new Date(next).toISOString()).toBe("2026-04-18T09:00:00.000Z")
  })
})

describe("computeNextFire", () => {
  it("handles every declarations", () => {
    const from = 1_700_000_000_000
    expect(computeNextFire({ every: "5s" }, from)).toBe(from + 5_000)
  })

  it("returns Infinity for a past one-shot schedule", () => {
    const from = Date.UTC(2026, 3, 17)
    const past = new Date(Date.UTC(2020, 0, 1)).toISOString()
    expect(computeNextFire({ at: past }, from)).toBe(Number.POSITIVE_INFINITY)
  })
})

describe("createScheduler", () => {
  it("fires due every-sources on tick", async () => {
    let now = 1_000_000
    const fired: string[] = []
    const scheduler = createScheduler({
      sources: [{ workflowId: "wf", decl: { every: "1s" } }],
      onFire: async ({ workflowId }) => {
        fired.push(workflowId)
      },
      now: () => now,
      tickMs: 10_000,
    })

    await scheduler.tick()
    expect(fired).toEqual([])

    now += 1_500
    await scheduler.tick()
    expect(fired).toEqual(["wf"])

    now += 500
    await scheduler.tick()
    expect(fired).toEqual(["wf"])

    now += 600
    await scheduler.tick()
    expect(fired).toEqual(["wf", "wf"])
  })

  it("resolves function input fresh on each fire", async () => {
    let now = 1_000
    let counter = 0
    const inputs: unknown[] = []
    const scheduler = createScheduler({
      sources: [
        {
          workflowId: "wf",
          decl: { every: "1s", input: () => ({ n: ++counter }) },
        },
      ],
      onFire: async ({ input }) => {
        inputs.push(input)
      },
      now: () => now,
    })

    now += 1_100
    await scheduler.tick()
    now += 1_100
    await scheduler.tick()

    expect(inputs).toEqual([{ n: 1 }, { n: 2 }])
  })

  it("fires one-shot schedules exactly once", async () => {
    let now = 1_000
    const fired: string[] = []
    const at = new Date(5_000).toISOString()
    const scheduler = createScheduler({
      sources: [{ workflowId: "wf", decl: { at } }],
      onFire: async ({ workflowId }) => {
        fired.push(workflowId)
      },
      now: () => now,
    })

    now = 4_000
    await scheduler.tick()
    expect(fired).toEqual([])

    now = 6_000
    await scheduler.tick()
    expect(fired).toEqual(["wf"])

    now = 7_000
    await scheduler.tick()
    expect(fired).toEqual(["wf"])
    expect(scheduler.nextFirings()[0]!.done).toBe(true)
  })
})

import { __resetRegistry, workflow } from "@voyantjs/workflows"
import { afterEach, describe, expect, test, vi } from "vitest"

import { WorkflowConcurrencyRejectedError } from "../concurrency.js"
import { createInMemoryDriver } from "../driver-inmemory.js"
import { testFactoryDeps } from "../testing/driver-compliance.js"

afterEach(() => {
  __resetRegistry()
})

describe("InMemory driver workflow concurrency", () => {
  test("queues triggers with the same concurrency key until the active run completes", async () => {
    const driver = createInMemoryDriver()(testFactoryDeps())
    const firstGate = deferred<void>()
    const started: string[] = []

    const wf = workflow<{ id: string }, string>({
      id: "concurrency.queue",
      concurrency: {
        key: (input) => input.id,
        limit: 1,
        strategy: "queue",
      },
      async run(input) {
        started.push(input.id)
        if (input.id === "same") {
          await firstGate.promise
        }
        return input.id
      },
    })

    const first = driver.trigger(wf, { id: "same" })
    await vi.waitFor(() => expect(started).toEqual(["same"]))

    const second = driver.trigger(wf, { id: "same" })
    await Promise.resolve()
    expect(started).toEqual(["same"])

    firstGate.resolve()
    await first
    await second

    expect(started).toEqual(["same", "same"])
  })

  test("allows up to limit active triggers before queueing", async () => {
    const driver = createInMemoryDriver()(testFactoryDeps())
    const gate = deferred<void>()
    const started: number[] = []

    const wf = workflow<{ n: number }, number>({
      id: "concurrency.limit",
      concurrency: {
        key: "shared",
        limit: 2,
        strategy: "queue",
      },
      async run(input) {
        started.push(input.n)
        await gate.promise
        return input.n
      },
    })

    const first = driver.trigger(wf, { n: 1 })
    const second = driver.trigger(wf, { n: 2 })
    await vi.waitFor(() => expect(started).toEqual([1, 2]))

    const third = driver.trigger(wf, { n: 3 })
    await Promise.resolve()
    expect(started).toEqual([1, 2])

    gate.resolve()
    await Promise.all([first, second, third])
    expect(started).toEqual([1, 2, 3])
  })

  test("rejects the newest trigger when cancel-newest is at capacity", async () => {
    const driver = createInMemoryDriver()(testFactoryDeps())
    const gate = deferred<void>()

    const wf = workflow<{ n: number }, number>({
      id: "concurrency.cancel-newest",
      concurrency: {
        key: "shared",
        limit: 1,
        strategy: "cancel-newest",
      },
      async run(input) {
        await gate.promise
        return input.n
      },
    })

    const first = driver.trigger(wf, { n: 1 })
    await expect(driver.trigger(wf, { n: 2 })).rejects.toBeInstanceOf(
      WorkflowConcurrencyRejectedError,
    )

    gate.resolve()
    const run = await first
    expect(run.status).toBe("completed")
  })

  test("cancels the in-progress run before starting a replacement", async () => {
    const driver = createInMemoryDriver()(testFactoryDeps())
    const started: number[] = []
    let firstAborted = false

    const wf = workflow<{ n: number }, number>({
      id: "concurrency.cancel-in-progress",
      concurrency: {
        key: "shared",
        limit: 1,
        strategy: "cancel-in-progress",
      },
      async run(input, ctx) {
        started.push(input.n)
        if (input.n === 1) {
          await ctx.step("block-until-cancelled", async (stepCtx) => {
            await new Promise<void>((resolve) => {
              stepCtx.signal.addEventListener(
                "abort",
                () => {
                  firstAborted = true
                  resolve()
                },
                { once: true },
              )
            })
          })
        }
        return input.n
      },
    })

    const first = driver.trigger(wf, { n: 1 })
    await vi.waitFor(() => expect(started).toEqual([1]))

    const second = await driver.trigger(wf, { n: 2 })
    expect(second.status).toBe("completed")
    expect(started).toEqual([1, 2])
    expect(firstAborted).toBe(true)

    const firstRun = await first
    expect(firstRun.status).toBe("cancelled")
  })
})

function deferred<T>(): {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: unknown): void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/**
 * MCP capability eval — can an agent do a travel agent's job? (voyant#3921)
 *
 * Everything else in this repo tests the MCP surface against a seeded in-memory
 * registry. That proves the transport and the projections, and it proved nothing
 * about whether the product WORKS: the first run of this file against the real
 * graph found that an agent could not add or find a client, because the surface
 * only answered to "person" and a travel agent says "client".
 *
 * So this is the proper instrument. Real selected graph, real MCP transport over
 * JSON-RPC, real database, real model choosing every call. It scores COMPLETION —
 * whether the work got done — and treats tokens and call counts as secondary,
 * because a cheap surface that cannot book a trip is worthless.
 *
 * Opt-in twice over: it needs TEST_DATABASE_URL and an OpenAI key, and skips
 * without either. It WRITES (that is the point), so point TEST_DATABASE_URL at a
 * disposable database.
 *
 * The journeys are chained on purpose — the person must exist before the booking,
 * the product before the departure — because that dependency is exactly what an
 * endpoint-shaped surface makes hard and what #3921 is trying to fix.
 */
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { createDbClient } from "@voyant-travel/db"
import { composeVoyantGraphRuntime } from "@voyant-travel/framework"
import { sql as sqlRaw } from "drizzle-orm"
import { Hono } from "hono"
import { beforeAll, describe, expect, it } from "vitest"

import { accessCatalog } from "../.voyant/access/selected-access-catalog.generated"
import {
  createGeneratedGraphRuntime,
  createGeneratedTestDeploymentResources,
} from "./api/generated-project-runtime.js"

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

function resolveKey(): string | undefined {
  const env = process.env.OPENAI_API_KEY?.trim()
  if (env) return env
  try {
    const v = readFileSync(join(homedir(), ".config/agent-run/openai-token"), "utf8").trim()
    return v.length > 0 ? v : undefined
  } catch {
    return undefined
  }
}
const apiKey = resolveKey()
const MODEL = process.env.VOYANT_EVAL_MODEL ?? "gpt-4o"
const enabled = Boolean(TEST_DATABASE_URL && apiKey)

/** A live model turn plus a real dispatch is slow; the default would time out on latency. */
const JOURNEY_TIMEOUT_MS = 180_000

const TEST_ENV = { DATABASE_URL: TEST_DATABASE_URL ?? "", VOYANT_API_KEY: "test" } as never
const TEST_CTX = { waitUntil() {}, passThroughOnException() {} } as never

let rpcSeq = 0
function rpc(method: string, params: unknown) {
  rpcSeq += 1
  return {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: rpcSeq, method, params }),
  }
}
async function readRpc(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    return JSON.parse(
      text
        .split("\n")
        .find((l) => l.startsWith("data:"))
        ?.slice(5)
        .trim() ?? "{}",
    )
  }
  try {
    return JSON.parse(text)
  } catch {
    return { error: { message: text.slice(0, 300) } }
  }
}

/** Mount the real selected-graph MCP behind a full-scope staff key and a REAL db. */
let verifyDb: ReturnType<typeof createDbClient> | undefined

async function mountRealMcp(): Promise<Hono> {
  const selected = await createGeneratedTestDeploymentResources(createGeneratedGraphRuntime())
  const composed = await composeVoyantGraphRuntime({
    runtime: selected.runtime,
    capabilities: selected.capabilities,
    ports: selected.ports,
  })
  const routes = await composed.modules
    .find((module) => module.module.name === "mcp")
    ?.lazyAdminRoutes?.()
  if (!routes) throw new Error("selected graph did not expose MCP admin routes")

  const db = createDbClient(TEST_DATABASE_URL as string, {
    adapter: "node",
    nodeMaxConnections: 4,
    timeouts: { statementMs: false, queryMs: false, connectMs: false },
  })
  verifyDb = db
  const scopes = accessCatalog.resources.flatMap((resource) =>
    resource.actions.map((action) => `${resource.resource}:${action.action}`),
  )
  const app = new Hono()
  app.use("*", async (c, next) => {
    c.set("scopes", scopes)
    c.set("actor", "staff")
    c.set("audience", "staff")
    c.set("db", db)
    c.set("userId", "user_capability_eval")
    await next()
  })
  app.route("/", routes)
  return app
}

interface ToolCallRecord {
  name: string
  args: Record<string, unknown>
  isError: boolean
  snippet: string
}
interface JourneyRun {
  calls: ToolCallRecord[]
  answer: string
  tokens: number
  exhausted: boolean
}

async function runJourney(input: {
  app: Hono
  tools: unknown[]
  task: string
  maxCalls: number
}): Promise<JourneyRun> {
  const messages: Array<Record<string, unknown>> = [
    {
      role: "system",
      content:
        "You are the back-office agent for a travel operator, connected to its MCP server. " +
        "Use the tools to actually perform the work end to end. Never invent data. If a write " +
        "reports that confirmation or approval is required, follow the instructions in the " +
        "error and complete it. Finish by stating what you created, including any ids.",
    },
    { role: "user", content: input.task },
  ]
  const calls: ToolCallRecord[] = []
  let tokens = 0

  for (let turn = 0; turn <= input.maxCalls; turn += 1) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages,
        tools: input.tools,
        tool_choice: "auto",
        temperature: 0,
      }),
    })
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const body = (await res.json()) as {
      choices?: Array<{ message: Record<string, unknown> }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    tokens += (body.usage?.prompt_tokens ?? 0) + (body.usage?.completion_tokens ?? 0)
    const message = body.choices?.[0]?.message
    if (!message) throw new Error("OpenAI returned no message")
    messages.push(message)

    const toolCalls =
      (message.tool_calls as Array<{
        id: string
        function: { name: string; arguments: string }
      }>) ?? []
    if (toolCalls.length === 0) {
      return { calls, answer: String(message.content ?? ""), tokens, exhausted: false }
    }

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>
      } catch {
        args = {}
      }
      const rpcBody = await readRpc(
        await input.app.request(
          "/",
          rpc("tools/call", { name: call.function.name, arguments: args }),
          TEST_ENV,
          TEST_CTX,
        ),
      )
      const result = rpcBody.result as
        | { isError?: boolean; content?: Array<{ text?: string }>; structuredContent?: unknown }
        | undefined
      const text = (
        result?.structuredContent !== undefined
          ? JSON.stringify(result.structuredContent)
          : (result?.content?.[0]?.text ?? JSON.stringify(rpcBody))
      ).slice(0, 12_000)
      calls.push({
        name: call.function.name,
        args,
        isError: result?.isError === true,
        snippet: text.slice(0, 300),
      })
      messages.push({ role: "tool", tool_call_id: call.id, content: text })
    }
  }
  return { calls, answer: "", tokens, exhausted: true }
}

/**
 * The travel agent's job, in dependency order.
 *
 * `verify` is a SQL existence check, and it is the real assertion. The first
 * version of this file scored journeys by looking for a substring in the model's
 * closing prose, and it produced false passes in both directions: `people-create`
 * was marked done because the answer contained "Ioana" — which it would have
 * whether or not a row was written — and `ops-departures` passed on the word
 * "departure" after a single `search_tools` call that queried nothing.
 *
 * An eval that grades an agent on what it SAYS rather than what it DID is worse
 * than no eval, because it reports green while the product is broken. So a write
 * journey is complete when the row exists, and a read journey is complete when
 * the answer contains a fact the model could only have obtained by calling a
 * tool. `expect` remains as a secondary prose check where a DB check cannot
 * express the question.
 */
/**
 * A per-run marker on every record this eval creates.
 *
 * Re-running with fixed names forced a choice between duplicate rows and deleting
 * the previous ones — and deleting them out of band corrupted the action ledger:
 * the created-target protocol replayed the original command, handed back the id
 * of the row that had just been deleted, and the agent truthfully reported a
 * success for a record that no longer existed. The ledger was right; the harness
 * was lying to it. Unique names per run mean the eval never has to delete
 * anything.
 */
const RUN_MARK = process.env.VOYANT_EVAL_MARK ?? String(Date.now()).slice(-6)

interface CapabilityJourney {
  id: string
  domain: string
  task: string
  expect: string
  maxCalls: number
  /** SQL returning >0 rows when the work actually happened. */
  verify?: string
  /** Reads must reach the data; a journey that answers without dispatching is a miss. */
  requiresDispatch?: boolean
  /**
   * A reproducible, unfixed surface gap. Asserted to keep FAILING, so closing it
   * turns the suite red and prompts promotion — an eval that quietly stops
   * exercising a known bug is how the bug returns.
   */
  knownGap?: string
}

const JOURNEYS: CapabilityJourney[] = [
  {
    id: "people-create",
    domain: "people",
    task: `Add a new private client named Ioana Marinescu${RUN_MARK} with email ioana.${RUN_MARK}@example.com. Confirm her id.`,
    expect: "ioana",
    maxCalls: 14,
    verify: `select 1 from people where last_name ilike '%marinescu${RUN_MARK}%'`,
  },
  {
    id: "people-find",
    domain: "people",
    task: `Find the client Ioana Marinescu${RUN_MARK} and tell me her email address.`,
    expect: `ioana.${RUN_MARK}@example.com`,
    maxCalls: 12,
    requiresDispatch: true,
  },
  {
    id: "product-create",
    domain: "products",
    task: `Create a product called 'Capability Eval Tour ${RUN_MARK}', a guided road tour sold by date. Confirm its id.`,
    expect: `capability eval tour ${RUN_MARK}`,
    maxCalls: 18,
    verify: `select 1 from products where name ilike '%capability eval tour ${RUN_MARK}%'`,
  },
  {
    id: "contracts-read",
    domain: "contracts",
    task: "What contract templates exist? If there are none, say so explicitly.",
    expect: "template",
    maxCalls: 12,
    requiresDispatch: true,
  },
  {
    id: "invoices-read",
    domain: "invoices",
    task: "How many invoices exist, and what is the most recent one? If there are none, say so explicitly.",
    expect: "invoice",
    maxCalls: 12,
    requiresDispatch: true,
  },
  {
    id: "ops-departures",
    domain: "ops",
    task: "List the departures scheduled for the catalog. If there are none, say so explicitly.",
    expect: "departure",
    maxCalls: 14,
    requiresDispatch: true,
    // Reproduced 4/4 runs. `search_tools("departures")` DOES return
    // operations_query, and the agent still answers "There are no tools available
    // to list departures, which suggests there are no departures scheduled" —
    // asserting a BUSINESS FACT from a discovery miss, without dispatching. The
    // vocabulary fixes moved the other five journeys and not this one, so the
    // cause is not the index. Same failure mode as the record-name search in the
    // mcp package's KNOWN_GAPS: the agent decides the data is absent because
    // discovery felt incomplete. Current read: the guide layer (W7) has to
    // establish up front that a query tool must be CALLED before concluding
    // anything is empty.
    knownGap: "answers from the tool index without dispatching (voyant#3921)",
  },
]

const runs = new Map<string, JourneyRun>()
const verified = new Map<string, boolean>()

/** Row count across the shapes a driver may return. */
function rowCount(rows: unknown): number {
  if (Array.isArray(rows)) return rows.length
  const count = (rows as { rowCount?: number; length?: number } | null)?.rowCount
  return typeof count === "number" ? count : ((rows as { length?: number } | null)?.length ?? 0)
}

/** Exactly the conditions `it.each` asserts, so the report can never disagree. */
function journeyPassed(journey: CapabilityJourney, run: JourneyRun): boolean {
  if (run.calls.length === 0) return false
  if (journey.verify) return verified.get(journey.id) === true
  if (journey.requiresDispatch) {
    const dispatched = run.calls.filter(
      (call) => call.name === "call_tool" || call.name.endsWith("_query"),
    )
    if (dispatched.length === 0) return false
  }
  return run.answer.toLowerCase().includes(journey.expect.toLowerCase())
}

function report(): string {
  const lines = [
    `MCP capability eval — real graph, real database, model=${MODEL} (voyant#3921)`,
    "  completion is the score; tokens are secondary",
  ]
  for (const journey of JOURNEYS) {
    const run = runs.get(journey.id)
    if (!run) {
      lines.push(`  ? ${journey.id.padEnd(18)} did not run`)
      continue
    }
    // The report must apply the SAME criteria as the assertion. It did not, and
    // printed ✓ for `ops-departures` on three consecutive runs that the suite
    // failed — a read journey that answered from the tool index without ever
    // dispatching. A report that disagrees with its own assertions is the same
    // defect this file was rewritten to remove, one level up.
    const done = journeyPassed(journey, run)
    const errs = run.calls.filter((c) => c.isError).length
    lines.push(
      `  ${done ? "✓" : "✗"} ${journey.id.padEnd(18)} [${journey.domain.padEnd(9)}] ` +
        `calls=${String(run.calls.length).padStart(2)} errors=${errs} tokens=${run.tokens}` +
        (run.exhausted ? " EXHAUSTED" : ""),
    )
    // Print the ARGUMENTS. "search_tools → gave up" and "search_tools(Ioana
    // Marinescu) → gave up" are the same line without them, and only the second
    // tells you the agent searched the tool catalog for a RECORD NAME.
    lines.push(
      `      ${
        run.calls
          .map((c) => {
            const detail = c.args.query ?? c.args.resource ?? c.args.name ?? ""
            return `${c.name}(${String(detail).slice(0, 40)})`
          })
          .join(" → ") || "(no tool calls)"
      }`,
    )
    if (!done) lines.push(`      answer: ${run.answer.slice(0, 220)}`)
    for (const failed of run.calls.filter((c) => c.isError)) {
      lines.push(`      ✗ ${failed.name}: ${failed.snippet.slice(0, 200)}`)
    }
  }
  return lines.join("\n")
}

describe.skipIf(!enabled)("MCP capability — a travel agent's job", () => {
  beforeAll(async () => {
    if (!enabled) return
    const app = await mountRealMcp()
    const listed = await readRpc(await app.request("/", rpc("tools/list", {}), TEST_ENV, TEST_CTX))
    const tools = (
      (listed.result as { tools?: Array<Record<string, unknown>> } | undefined)?.tools ?? []
    ).map((tool) => ({
      type: "function" as const,
      function: {
        name: String(tool.name),
        description: String(tool.description ?? "").slice(0, 1024),
        parameters: tool.inputSchema ?? { type: "object", properties: {} },
      },
    }))

    for (const journey of JOURNEYS) {
      try {
        runs.set(
          journey.id,
          await runJourney({ app, tools, task: journey.task, maxCalls: journey.maxCalls }),
        )
      } catch (err) {
        runs.set(journey.id, {
          calls: [],
          answer: `FATAL: ${String(err).slice(0, 300)}`,
          tokens: 0,
          exhausted: true,
        })
      }
    }
    // Grade against the DATABASE, not the closing prose. Done after all journeys
    // so a later one cannot be blamed for an earlier one's missing row.
    for (const journey of JOURNEYS) {
      if (!journey.verify) continue
      const rows = await (verifyDb as { execute: (q: unknown) => Promise<unknown> }).execute(
        // `sql` is a TEMPLATE TAG — passing a plain string makes drizzle read it as
        // a template-strings array and send only its first character. `sql.raw`
        // is the escape hatch for a query built as a string.
        sqlRaw.raw(journey.verify),
      )
      verified.set(journey.id, rowCount(rows) > 0)
    }
    process.stdout.write(`\n${report()}\n\n`)
  }, JOURNEY_TIMEOUT_MS * JOURNEYS.length)

  it.each(
    JOURNEYS.filter((journey) => journey.knownGap),
  )("still cannot complete '$id' — documented gap", (journey) => {
    const run = runs.get(journey.id)
    expect(run, `${journey.id} did not run`).toBeDefined()
    expect(
      run ? journeyPassed(journey, run) : false,
      `'${journey.id}' now SUCCEEDS (${journey.knownGap}). Verify across several runs, then ` +
        "remove its knownGap so it is asserted as a real journey.",
    ).toBe(false)
  })

  it.each(
    JOURNEYS.filter((journey) => !journey.knownGap),
  )("completes '$id' [$domain]", (journey) => {
    const { id, expect: needle, verify, requiresDispatch } = journey
    const run = runs.get(id)
    expect(run, `${id} did not run`).toBeDefined()
    expect(run?.calls.length, `${id} answered without calling any tool`).toBeGreaterThan(0)

    if (verify) {
      // The real assertion for a write: the row exists. Prose is not evidence.
      expect(
        verified.get(id),
        `${id} did not write its record. The agent said: ${run?.answer.slice(0, 300)}`,
      ).toBe(true)
      return
    }

    if (requiresDispatch) {
      // A read journey that never dispatched answered from the tool INDEX, not
      // from the data — the exact false pass this file used to produce.
      const dispatched = (run?.calls ?? []).filter(
        (call) => call.name === "call_tool" || call.name.endsWith("_query"),
      )
      expect(
        dispatched.length,
        `${id} answered without querying any data: ${run?.answer.slice(0, 300)}`,
      ).toBeGreaterThan(0)
    }

    expect(run?.answer.toLowerCase(), `${id}: ${run?.answer.slice(0, 300)}`).toContain(
      needle.toLowerCase(),
    )
  })
})

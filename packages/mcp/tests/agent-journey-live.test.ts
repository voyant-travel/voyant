/**
 * Live-client agent journey eval (voyant#3936, RFC voyant#3921).
 *
 * OPT-IN. Skipped with no `OPENAI_API_KEY` (or `~/.config/agent-run/openai-token`),
 * so CI stays deterministic and a rotated key can never redden the build. Run it
 * deliberately, when changing the prose an agent depends on.
 *
 * Why it exists alongside the scripted lane rather than replacing it: the
 * scripted driver is handed the tool name, the resource, and the argument shape,
 * so it proves the mechanics work and nothing about whether an agent can FIND its
 * way. Every remaining #3921 claim is a claim about prose —
 *
 *   - `search_tools` returns one-line descriptions that should lead to the right
 *     tool without a schema,
 *   - a query tool's description should make a model pass `resource` to
 *     `describe_tool` instead of pulling the whole union,
 *   - `nextSteps` on a ToolError should be followable enough to recover,
 *
 * — and prose cannot be unit-tested. A model is the only instrument that reads it
 * the way the customer does.
 *
 * These assertions are deliberately loose. The tight ones live in the scripted
 * lane; here a hard equality would just be flake, because the thing under test is
 * a probabilistic reader. What is asserted is the OUTCOME (did it get the answer,
 * without wandering), and the report prints the transcript so a regression in
 * wording is legible rather than merely numeric.
 */
import { beforeAll, describe, expect, it } from "vitest"

import { honoTransport } from "./support/journey-harness.js"
import {
  type LiveRunResult,
  resolveOpenAiKey,
  runLiveJourney,
  tierZeroAsOpenAiTools,
} from "./support/live-client.js"
import { seededMcpApp } from "./support/seeded-deployment.js"

const apiKey = resolveOpenAiKey()

/** Overridable so a run can be pointed at a different tier without an edit. */
const MODEL = process.env.VOYANT_EVAL_MODEL ?? "gpt-4o-mini"

/**
 * A live call is slow and rate-limited; the default 5s would fail on latency
 * rather than on anything this test is about.
 */
const LIVE_TIMEOUT_MS = 120_000

interface LiveScenario {
  id: string
  task: string
  /** The answer is correct when it contains this, case-insensitively. */
  expect: string
  /** Generous cap — exceeding it means the model wandered, which is the finding. */
  maxCalls: number
}

const SCENARIOS: LiveScenario[] = [
  {
    // Can a model get from a plain question to the right collapsed query tool
    // using only one-line search results? This is the discovery claim.
    id: "find-a-product",
    task: "What products are in the catalog? Name them.",
    expect: "kyoto",
    maxCalls: 6,
  },
  {
    // Chains an id from one result into the next call — the pattern #3921
    // Finding 2 says we should stop asking models to do, kept here as a READ so
    // it stays cheap and deterministic enough to assert on.
    id: "chain-an-id",
    task: "What is the itinerary of the Kyoto Cherry Blossom Tour? List the stops.",
    expect: "bamboo",
    maxCalls: 8,
  },
  {
    // The actionable-error claim (voyant#3947/#3950): a deliberately impossible
    // filter should produce a recoverable failure, not a dead end.
    id: "recover-from-error",
    task: "List bookings whose status is 'confirmed'. Report how many there are.",
    expect: "2",
    maxCalls: 6,
  },
]

const scores = new Map<string, LiveRunResult>()

function formatReport(): string {
  const lines = [
    `live-client agent journey eval — model=${MODEL} (voyant#3936)`,
    "  columns: id | mcp calls | prompt+completion tokens (real) | tool sequence",
  ]
  for (const [id, run] of scores) {
    const sequence = run.calls
      .map((c) => `${c.name}${c.args.resource ? `(${String(c.args.resource)})` : ""}`)
      .join(" → ")
    lines.push(
      `  ${run.exhausted ? "✗" : "✓"} ${id.padEnd(20)} calls=${String(run.calls.length).padStart(2)} ` +
        `tokens=${String(run.promptTokens + run.completionTokens).padStart(6)} ${sequence}`,
    )
  }
  return lines.join("\n")
}

describe.skipIf(!apiKey)("live-client agent journey eval", () => {
  beforeAll(async () => {
    if (!apiKey) return
    const app = seededMcpApp()
    const transport = honoTransport(app)
    const tools = await tierZeroAsOpenAiTools(transport)

    /** Dispatch what the model asked for straight at the MCP surface. */
    const callTool = async (name: string, args: Record<string, unknown>) => {
      const body = await transport("tools/call", { name, arguments: args })
      const result = body.result as
        | { isError?: boolean; content?: Array<{ text?: string }>; structuredContent?: unknown }
        | undefined
      const text =
        result?.structuredContent !== undefined
          ? JSON.stringify(result.structuredContent)
          : (result?.content?.[0]?.text ?? JSON.stringify(body))
      return { text, isError: result?.isError === true }
    }

    for (const scenario of SCENARIOS) {
      scores.set(
        scenario.id,
        await runLiveJourney({
          apiKey,
          model: MODEL,
          task: scenario.task,
          systemPrompt:
            "You are connected to a travel operator's MCP server. Use the provided " +
            "tools to answer. Do not invent data — every fact must come from a tool result.",
          tools,
          callTool,
          maxCalls: scenario.maxCalls,
        }),
      )
    }
    process.stdout.write(`\n${formatReport()}\n\n`)
  }, LIVE_TIMEOUT_MS * SCENARIOS.length)

  it.each(SCENARIOS)("answers '$id' from tool results alone", ({ id, expect: needle }) => {
    const run = scores.get(id)
    expect(run, `${id} did not run`).toBeDefined()
    expect(run?.exhausted, `${id} exhausted its call budget without answering`).toBe(false)
    expect(run?.answer.toLowerCase(), `${id} answer: ${run?.answer}`).toContain(
      needle.toLowerCase(),
    )
  })

  it("reaches every answer through the MCP surface, never from model memory", () => {
    // The failure this guards is the quiet one: a model that answers plausibly
    // from pretraining without calling anything looks like a pass on the answer
    // assertion alone, and would mask a surface that is impossible to use.
    for (const [id, run] of scores) {
      expect(run.calls.length, `${id} answered without calling any tool`).toBeGreaterThan(0)
    }
  })

  it("uses the narrowed describe_tool rather than pulling a whole union", () => {
    // The voyant#4254 claim under test is not that narrowing WORKS — the scripted
    // lane proves that — but that a query tool's description leads a model to use
    // it unprompted. If this fails, the mechanism is fine and the wording is not,
    // which is a finding no schema-level test can produce.
    const describeCalls = [...scores.values()]
      .flatMap((run) => run.calls)
      .filter((call) => call.name === "describe_tool")

    // Not every scenario needs a describe; only judge the ones that did.
    if (describeCalls.length === 0) return

    const narrowed = describeCalls.filter((call) => typeof call.args.resource === "string")
    expect(
      narrowed.length,
      `${describeCalls.length} describe_tool call(s), none passed 'resource'. The narrowing ` +
        "exists but the description is not leading the model to it — read the printed report.",
    ).toBeGreaterThan(0)
  })
})

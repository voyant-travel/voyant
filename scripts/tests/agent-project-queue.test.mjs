import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { extractAgentBrief, hasAgentBrief } from "../lib/agent-brief-parser.mjs"
import {
  evaluateItem,
  filterItemsByRepository,
  loadAllEvaluatedProject,
  parseArgs,
  projectConfigFromArgs,
  projectNumberFromUrl,
  projectScanConfigFromArgs,
} from "../lib/agent-project-queue.mjs"

describe("agent project queue helpers", () => {
  it("parses boolean, equals, and separated runner arguments", () => {
    assert.deepEqual(
      parseArgs([
        "--issue",
        "123",
        "--json",
        "--allow-dirty",
        "--allow-browser-issues",
        "--smoke-tick",
        "--update-body",
        "--max-age-days=2",
        "--command=pnpm --filter=@voyant-travel/db test",
        "-h",
      ]),
      {
        issue: "123",
        json: true,
        allowDirty: true,
        allowBrowserIssues: true,
        smokeTick: true,
        updateBody: true,
        maxAgeDays: "2",
        command: "pnpm --filter=@voyant-travel/db test",
        help: true,
      },
    )
  })

  it("parses project numbers from GitHub Project URLs", () => {
    assert.equal(projectNumberFromUrl("https://github.com/orgs/voyant-travel/projects/42/views/1"), "42")
    assert.equal(projectNumberFromUrl("https://github.com/orgs/voyant-travel/projects/7"), "7")
    assert.equal(projectNumberFromUrl("https://github.com/voyant-travel/voyant/issues/7"), undefined)
  })

  it("keeps single page config limits strict while scan config defaults to a full page", () => {
    assert.deepEqual(projectConfigFromArgs({ owner: "voyant-travel", project: "2" }), {
      owner: "voyant-travel",
      projectNumber: 2,
      limit: 50,
    })

    assert.deepEqual(projectScanConfigFromArgs({ owner: "voyant-travel", project: "2" }), {
      owner: "voyant-travel",
      projectNumber: 2,
      limit: 100,
    })

    assert.deepEqual(projectScanConfigFromArgs({ owner: "voyant-travel", project: "2", limit: "25" }), {
      owner: "voyant-travel",
      projectNumber: 2,
      limit: 25,
    })
  })

  it("evaluates ready issues and derives execution paths", () => {
    const evaluated = evaluateItem(
      projectItem({
        number: 579,
        title: "[Bug] Fix agent intake workflow",
        fields: {
          "Agent State": "Ready",
          "Maintainer Approved": "Yes",
          "Verification Lane": "verify:full",
          Risk: "Medium",
          "Security Risk": "Low",
          "Agent Provider": "manual",
        },
      }),
    )

    assert.equal(evaluated.ready, true)
    assert.equal(evaluated.issue.number, 579)
    assert.equal(
      evaluated.issue.agentBrief,
      "Current behavior, desired behavior, acceptance criteria, and verification lane.",
    )
    assert.equal(evaluated.dryRunPlan.branch, "bug/579-fix-agent-intake-workflow")
    assert.equal(
      evaluated.dryRunPlan.planPath,
      "docs/agent-plans/active/579-fix-agent-intake-workflow.md",
    )
    assert.equal(evaluated.dryRunPlan.workspace, ".agent-worktrees/579-fix-agent-intake-workflow")
    assert.equal(evaluated.dryRunPlan.verificationLane, "verify:full")
  })

  it("records gate reasons for non-executable items", () => {
    const evaluated = evaluateItem(
      projectItem({
        labels: [],
        state: "CLOSED",
        fields: {
          "Agent State": "Running",
          "Maintainer Approved": "No",
        },
      }),
    )

    assert.equal(evaluated.ready, false)
    assert.deepEqual(evaluated.reasons, [
      "issue state is CLOSED",
      "missing label agent:ready",
      'Agent State is "Running"',
      'Maintainer Approved is "No"',
    ])
  })

  it("requires a durable Agent Brief before an item is executable", () => {
    const evaluated = evaluateItem(
      projectItem({
        body: "### Agent Brief\n_No response_\n\n### Additional notes\nLater.",
      }),
    )

    assert.equal(evaluated.ready, false)
    assert.deepEqual(evaluated.reasons, ["missing Agent Brief section"])
  })

  it("detects non-empty Agent Brief sections", () => {
    const body = "## Agent Brief\nCurrent behavior, desired behavior, acceptance criteria."
    assert.equal(hasAgentBrief(body), true)
    assert.equal(
      extractAgentBrief(`${body}\n\n## Notes\nLater`),
      "Current behavior, desired behavior, acceptance criteria.",
    )
    assert.equal(hasAgentBrief("### Agent Brief\nTBD\n\n### Notes\nLater"), false)
    assert.equal(hasAgentBrief("## Notes\nNo brief yet"), false)
  })

  it("filters evaluated items by repository case-insensitively", () => {
    const items = [
      evaluateItem(projectItem({ number: 1, repository: "Voyant-Travel/Voyant" })),
      evaluateItem(projectItem({ number: 2, repository: "Voyant-Travel/Docs" })),
    ]

    assert.deepEqual(
      filterItemsByRepository(items, "voyant-travel/voyant").map((item) => item.issue.number),
      [1],
    )
  })

  it("loads every project page before evaluating the queue", () => {
    const calls = []
    const project = loadAllEvaluatedProject({
      owner: "voyant-travel",
      projectNumber: 1,
      limit: 25,
      readItems: ({ after, limit, owner, projectNumber }) => {
        calls.push({ after, limit, owner, projectNumber })
        return after
          ? projectPage({
              items: [projectItem({ id: "item-2", number: 2, title: "[Cleanup] Prune queue" })],
              pageInfo: { endCursor: null, hasNextPage: false },
            })
          : projectPage({
              items: [projectItem({ id: "item-1", number: 1, title: "[Task] Add queue tests" })],
              pageInfo: { endCursor: "cursor-1", hasNextPage: true },
            })
      },
    })

    assert.deepEqual(calls, [
      { after: undefined, limit: 25, owner: "voyant-travel", projectNumber: 1 },
      { after: "cursor-1", limit: 25, owner: "voyant-travel", projectNumber: 1 },
    ])
    assert.equal(project.projectId, "project-1")
    assert.equal(project.items.length, 2)
    assert.deepEqual(
      project.readyItems.map((item) => item.issue.number),
      [1, 2],
    )
  })

  it("fails pagination when GitHub reports another page without a cursor", () => {
    assert.throws(
      () =>
        loadAllEvaluatedProject({
          owner: "voyant-travel",
          projectNumber: 1,
          onError: (message) => {
            throw new Error(message)
          },
          readItems: () =>
            projectPage({
              pageInfo: { endCursor: null, hasNextPage: true },
            }),
        }),
      /Project item pagination returned no cursor/,
    )
  })
})

function projectPage({ items = [], pageInfo = { endCursor: null, hasNextPage: false } } = {}) {
  return {
    id: "project-1",
    title: "Voyant Engineering",
    fields: [],
    items,
    pageInfo,
  }
}

function projectItem({
  id = "item-1",
  number = 1,
  body = "## Agent Brief\nCurrent behavior, desired behavior, acceptance criteria, and verification lane.",
  title = "[Task] Implement queue runner",
  state = "OPEN",
  repository = "Voyant-Travel/Voyant",
  labels = ["agent:ready"],
  fields = {
    "Agent State": "Ready",
    "Maintainer Approved": "Yes",
  },
} = {}) {
  return {
    id,
    content: {
      number,
      body,
      title,
      url: `https://github.com/${repository}/issues/${number}`,
      state,
      repository: {
        nameWithOwner: repository,
      },
      labels: {
        nodes: labels.map((name) => ({ name })),
      },
    },
    fieldValues: {
      nodes: Object.entries(fields).map(([name, value]) => ({
        name: value,
        field: {
          name,
        },
      })),
    },
  }
}

import assert from "node:assert/strict"
import { describe, it } from "node:test"

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
        "--max-age-days=2",
        "--command=pnpm --filter=@voyantjs/db test",
        "-h",
      ]),
      {
        issue: "123",
        json: true,
        allowDirty: true,
        maxAgeDays: "2",
        command: "pnpm --filter=@voyantjs/db test",
        help: true,
      },
    )
  })

  it("parses project numbers from GitHub Project URLs", () => {
    assert.equal(projectNumberFromUrl("https://github.com/orgs/voyantjs/projects/42/views/1"), "42")
    assert.equal(projectNumberFromUrl("https://github.com/orgs/voyantjs/projects/7"), "7")
    assert.equal(projectNumberFromUrl("https://github.com/voyantjs/voyant/issues/7"), undefined)
  })

  it("keeps single page config limits strict while scan config defaults to a full page", () => {
    assert.deepEqual(projectConfigFromArgs({ owner: "voyantjs", project: "2" }), {
      owner: "voyantjs",
      projectNumber: 2,
      limit: 50,
    })

    assert.deepEqual(projectScanConfigFromArgs({ owner: "voyantjs", project: "2" }), {
      owner: "voyantjs",
      projectNumber: 2,
      limit: 100,
    })

    assert.deepEqual(projectScanConfigFromArgs({ owner: "voyantjs", project: "2", limit: "25" }), {
      owner: "voyantjs",
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

  it("filters evaluated items by repository case-insensitively", () => {
    const items = [
      evaluateItem(projectItem({ number: 1, repository: "VoyantJS/Voyant" })),
      evaluateItem(projectItem({ number: 2, repository: "VoyantJS/Docs" })),
    ]

    assert.deepEqual(
      filterItemsByRepository(items, "voyantjs/voyant").map((item) => item.issue.number),
      [1],
    )
  })

  it("loads every project page before evaluating the queue", () => {
    const calls = []
    const project = loadAllEvaluatedProject({
      owner: "voyantjs",
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
      { after: undefined, limit: 25, owner: "voyantjs", projectNumber: 1 },
      { after: "cursor-1", limit: 25, owner: "voyantjs", projectNumber: 1 },
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
          owner: "voyantjs",
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
  title = "[Task] Implement queue runner",
  state = "OPEN",
  repository = "VoyantJS/Voyant",
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

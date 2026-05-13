import { describe, expect, it } from "vitest"

import { selectDispatchPlan } from "./control-plane.js"
import { recommendations } from "./control-plane-test-fixtures.js"

describe("control-plane dispatch planning", () => {
  it("selects the first matching dispatchable plan", () => {
    expect(
      selectDispatchPlan({
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      reason: "matched",
      plan: {
        action: "start",
        command: [
          "pnpm",
          "agent:queue:start",
          "--",
          "--issue",
          "579",
          "--repo",
          "voyantjs/voyant",
          "--yes",
        ],
        issue: recommendations[1]?.issue,
        reason: "maintainer-approved item is ready to claim",
        repository: "voyantjs/voyant",
        requiresMutation: true,
      },
    })
  })

  it("turns ready items into remote bootstrap plans when a remote workspace is assigned", () => {
    expect(
      selectDispatchPlan({
        filters: { action: "start" },
        options: { remoteWorkspace: "sandbox:sprite:voyant-agent-01-slot-1" },
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      reason: "matched",
      plan: {
        action: "remote-bootstrap",
        command: [
          "pnpm",
          "agent:queue:remote-bootstrap",
          "--",
          "--issue",
          "579",
          "--repo",
          "voyantjs/voyant",
          "--workspace",
          "sandbox:sprite:voyant-agent-01-slot-1",
          "--yes",
        ],
        issue: recommendations[1]?.issue,
        reason: "maintainer-approved item is ready to claim",
        repository: "voyantjs/voyant",
        requiresMutation: true,
      },
    })
  })

  it("applies issue, action, and repository filters", () => {
    expect(
      selectDispatchPlan({
        filters: { action: "start", issueNumber: 579 },
        recommendations,
        repository: "VoyantJS/Voyant",
      }).plan?.issue.number,
    ).toBe(579)

    expect(
      selectDispatchPlan({
        filters: { action: "cleanup" },
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      plan: null,
      reason: "no dispatchable recommendation matched",
    })

    expect(
      selectDispatchPlan({
        filters: { action: "run-command" },
        recommendations,
        repository: "voyantjs/voyant",
      }),
    ).toEqual({
      plan: null,
      reason: "run-command requires implementation command",
    })
  })

  it("selects CI evidence collection and explicit implementation execution", () => {
    const ciRecommendation = {
      action: "collect-ci",
      reason: "failing PR checks need a local CI repair packet",
      issue: {
        number: 626,
        title: "Repair failing checks",
        url: "https://github.com/voyantjs/voyant/issues/626",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        recommendations: [ciRecommendation, recommendations[0]!],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "collect-ci",
      command: [
        "pnpm",
        "agent:queue:collect-ci",
        "--",
        "--issue",
        "626",
        "--repo",
        "voyantjs/voyant",
        "--yes",
      ],
    })

    expect(
      selectDispatchPlan({
        options: { implementationCommand: "agent-exec smoke" },
        recommendations: [recommendations[0]!],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "run-command",
      command: [
        "pnpm",
        "agent:queue:run-command",
        "--",
        "--issue",
        "581",
        "--repo",
        "voyantjs/voyant",
        "--command",
        "agent-exec smoke",
        "--yes",
      ],
    })
  })

  it("plans explicit remote implementation commands", () => {
    const remoteRecommendation = {
      action: "remote-run-command",
      reason: "remote implementation execution remains explicit",
      issue: {
        number: 629,
        title: "Run remote implementation",
        url: "https://github.com/voyantjs/voyant/issues/629",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        options: { remoteImplementationCommand: "agent-exec remote smoke" },
        recommendations: [remoteRecommendation],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "remote-run-command",
      command: [
        "pnpm",
        "agent:queue:remote-run-command",
        "--",
        "--issue",
        "629",
        "--repo",
        "voyantjs/voyant",
        "--command",
        "agent-exec remote smoke",
        "--yes",
      ],
    })
  })

  it("plans configured CI repair wrappers", () => {
    const repairRecommendation = {
      action: "repair-ci",
      reason: "CI repair packet is ready for automatic repair",
      issue: {
        number: 626,
        title: "Repair failing checks",
        url: "https://github.com/voyantjs/voyant/issues/626",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        options: { ciRepairCommand: "pnpm verify:fast" },
        recommendations: [repairRecommendation],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "repair-ci",
      command: [
        "pnpm",
        "agent:queue:repair-ci",
        "--",
        "--issue",
        "626",
        "--repo",
        "voyantjs/voyant",
        "--yes",
        "--ci-repair-command",
        "pnpm verify:fast",
      ],
    })
  })

  it("plans allow-listed remote lifecycle actions", () => {
    const remoteRecommendation = {
      action: "remote-publish-evidence",
      reason: "remote workspace evidence should be published before PR creation",
      issue: {
        number: 628,
        title: "Publish remote evidence",
        url: "https://github.com/voyantjs/voyant/issues/628",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        recommendations: [remoteRecommendation],
        repository: "voyantjs/voyant",
      }).plan,
    ).toMatchObject({
      action: "remote-publish-evidence",
      command: [
        "pnpm",
        "agent:queue:remote-publish-evidence",
        "--",
        "--issue",
        "628",
        "--repo",
        "voyantjs/voyant",
        "--yes",
      ],
    })
  })

  it("adds event log context to planned lifecycle commands", () => {
    expect(
      selectDispatchPlan({
        options: { eventLog: ".agent-runs/supervisor.jsonl" },
        recommendations: [recommendations[1]!],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).toEqual([
      "pnpm",
      "agent:queue:start",
      "--",
      "--issue",
      "579",
      "--repo",
      "voyantjs/voyant",
      "--yes",
      "--event-log",
      ".agent-runs/supervisor.jsonl",
    ])
  })

  it("adds PR body refresh only for sync plans", () => {
    const syncRecommendation = {
      action: "sync-pr",
      reason: "linked PR should be synced back to the Project",
      issue: {
        number: 627,
        title: "Sync review state",
        url: "https://github.com/voyantjs/voyant/issues/627",
        repository: "voyantjs/voyant",
      },
    }

    expect(
      selectDispatchPlan({
        options: { eventLog: ".agent-runs/supervisor.jsonl", updateBody: true },
        recommendations: [syncRecommendation],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).toEqual([
      "pnpm",
      "agent:queue:sync-pr",
      "--",
      "--issue",
      "627",
      "--repo",
      "voyantjs/voyant",
      "--yes",
      "--event-log",
      ".agent-runs/supervisor.jsonl",
      "--update-body",
    ])

    expect(
      selectDispatchPlan({
        options: { updateBody: true },
        recommendations: [recommendations[1]!],
        repository: "voyantjs/voyant",
      }).plan?.command,
    ).not.toContain("--update-body")
  })
})

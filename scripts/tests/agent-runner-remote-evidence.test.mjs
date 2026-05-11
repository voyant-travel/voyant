import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  decodeRemoteBase64File,
  remoteEvidencePublicationFieldValues,
  remoteEvidencePublicationPlan,
  remoteReadFileBase64Shell,
} from "../lib/agent-runner-remote-evidence.mjs"
import { workItem } from "./agent-fixtures.mjs"

const descriptor = {
  id: "task-579",
  kind: "remote-sandbox",
  provider: "sprite",
  reference: "sandbox:sprite:task-579",
}

describe("agent runner remote evidence helpers", () => {
  it("plans safe remote evidence paths inside the repository directory", () => {
    const plan = remoteEvidencePublicationPlan({
      descriptor,
      item: workItem({
        fields: {
          Evidence: "docs/agent-evidence/active/579-test.md",
        },
      }),
      workspaceReference: "sandbox:sprite:task-579",
    })

    assert.equal(plan.workspace, "/home/sprite/voyant-workspaces/task-579/repo")
    assert.equal(
      plan.evidenceFile,
      "/home/sprite/voyant-workspaces/task-579/repo/docs/agent-evidence/active/579-test.md",
    )
    assert.equal(plan.safeEvidencePath, true)
  })

  it("rejects absolute or escaping evidence paths", () => {
    assert.equal(
      remoteEvidencePublicationPlan({
        descriptor,
        evidencePath: "/tmp/evidence.md",
        item: workItem(),
        workspaceReference: "sandbox:sprite:task-579",
      }).safeEvidencePath,
      false,
    )
    assert.equal(
      remoteEvidencePublicationPlan({
        descriptor,
        evidencePath: "../evidence.md",
        item: workItem(),
        workspaceReference: "sandbox:sprite:task-579",
      }).safeEvidencePath,
      false,
    )
  })

  it("builds a remote base64 file read shell and decodes the result", () => {
    const shell = remoteReadFileBase64Shell({
      file: "/home/sprite/voyant-workspaces/task-579/repo/docs/evidence.md",
    })

    assert.match(shell, /test -f "\$file"/)
    assert.match(shell, /base64 "\$file" \| tr -d '\\n'/)
    assert.equal(
      decodeRemoteBase64File({
        file: "docs/evidence.md",
        stdout: Buffer.from("# Evidence\n").toString("base64"),
      }),
      "# Evidence\n",
    )
  })

  it("builds Project field values for published remote evidence", () => {
    assert.deepEqual(
      remoteEvidencePublicationFieldValues({
        date: new Date("2026-05-11T12:00:00Z"),
        evidenceUrl: "https://artifacts.example.com/evidence.md",
      }),
      {
        Evidence: "https://artifacts.example.com/evidence.md",
        "Last Heartbeat": "2026-05-11",
      },
    )
  })
})

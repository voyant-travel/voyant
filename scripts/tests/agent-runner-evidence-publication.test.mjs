import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  evidenceCommentBody,
  evidenceMarker,
  isRemoteEvidence,
} from "../lib/agent-runner-evidence-publication.mjs"

describe("agent runner evidence publication helpers", () => {
  it("builds stable evidence markers for idempotent GitHub comments", () => {
    assert.equal(
      evidenceMarker({
        evidenceReference: "docs/agent-evidence/active/579-test.md",
        issueNumber: 579,
        repository: "voyant-travel/voyant",
      }),
      "<!-- voyant-agent-evidence:dm95YW50anMvdm95YW50IzU3OTpkb2NzL2FnZW50LWV2aWRlbmNlL2FjdGl2ZS81NzktdGVzdC5tZA -->",
    )
  })

  it("prepends durable artifact links when evidence is published remotely", () => {
    assert.equal(
      evidenceCommentBody({
        evidenceBody: "# Evidence\n",
        marker: "<!-- marker -->",
        remoteEvidenceUrl: "https://artifacts.example.com/evidence.md",
      }),
      "<!-- marker -->\n\nPublished evidence packet: https://artifacts.example.com/evidence.md\n\n# Evidence\n",
    )
  })

  it("detects remote evidence URLs", () => {
    assert.equal(isRemoteEvidence("https://artifacts.example.com/evidence.md"), true)
    assert.equal(isRemoteEvidence("docs/agent-evidence/active/579-test.md"), false)
  })
})

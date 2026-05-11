import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import {
  artifactPublisherFromEnv,
  publishArtifactDirectory,
  publishEvidencePacket,
} from "../lib/agent-runner-artifacts.mjs"
import { browserEvidenceText } from "../lib/agent-runner-browser-evidence.mjs"

describe("agent runner artifact publishing", () => {
  it("requires durable R2/S3 configuration before publishing", () => {
    assert.throws(
      () => artifactPublisherFromEnv({}),
      /artifact publishing is missing configuration: .*VOYANT_AGENT_ARTIFACT_BUCKET/,
    )
  })

  it("uploads a directory to the configured R2 key prefix", async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), "voyant-agent-artifacts-"))
    try {
      mkdirSync(path.join(tempDir, "screenshots"), { recursive: true })
      mkdirSync(path.join(tempDir, "videos"), { recursive: true })
      writeFileSync(path.join(tempDir, "README.md"), "# Evidence\n", "utf8")
      writeFileSync(path.join(tempDir, "summary.json"), "{}\n", "utf8")
      writeFileSync(path.join(tempDir, "screenshots", "page.png"), "png", "utf8")
      writeFileSync(path.join(tempDir, "videos", "page.webm"), "webm", "utf8")

      const requests = []
      const publisher = artifactPublisherFromEnv(
        {
          VOYANT_AGENT_R2_ACCESS_KEY_ID: "access-key",
          VOYANT_AGENT_R2_ACCOUNT_ID: "account-id",
          VOYANT_AGENT_R2_BUCKET: "agent-artifacts",
          VOYANT_AGENT_R2_PREFIX: "runs",
          VOYANT_AGENT_R2_PUBLIC_BASE_URL: "https://artifacts.example.com",
          VOYANT_AGENT_R2_SECRET_ACCESS_KEY: "secret-key",
        },
        {
          fetchImpl: async (url, init) => {
            requests.push({ init, url })
            return {
              ok: true,
              status: 200,
              text: async () => "",
            }
          },
        },
      )

      const publication = await publishArtifactDirectory({
        directory: tempDir,
        issueNumber: 651,
        publisher,
        reference: "docs/agent-evidence/browser/651-task/2026-05-11T10-30-11-222Z",
        repository: "voyantjs/voyant",
      })

      assert.equal(publication.indexUrl.endsWith("/index.md"), true)
      assert.equal(publication.manifestUrl.endsWith("/manifest.json"), true)
      assert.equal(requests.length, 6)
      assert.match(requests[0].url, /^https:\/\/account-id\.r2\.cloudflarestorage\.com\//)
      assert.match(
        requests[0].url,
        /agent-artifacts\/runs\/voyantjs\/voyant\/docs\/agent-evidence\/browser\/651-task/,
      )
      assert.equal(
        requests.some((request) => request.init.headers.Authorization),
        true,
      )
      assert.equal(
        requests.some((request) => request.init.headers["content-type"] === "image/png"),
        true,
      )
      assert.equal(
        publication.uploaded.some((artifact) => artifact.path === "videos/page.webm"),
        true,
      )
    } finally {
      rmSync(tempDir, { force: true, recursive: true })
    }
  })

  it("uploads an evidence packet to a durable object key", async () => {
    const requests = []
    const publisher = artifactPublisherFromEnv(
      {
        VOYANT_AGENT_R2_ACCESS_KEY_ID: "access-key",
        VOYANT_AGENT_R2_ACCOUNT_ID: "account-id",
        VOYANT_AGENT_R2_BUCKET: "agent-artifacts",
        VOYANT_AGENT_R2_PUBLIC_BASE_URL: "https://artifacts.example.com",
        VOYANT_AGENT_R2_SECRET_ACCESS_KEY: "secret-key",
      },
      {
        fetchImpl: async (url, init) => {
          requests.push({ init, url })
          return {
            ok: true,
            status: 200,
            text: async () => "",
          }
        },
      },
    )

    const publication = await publishEvidencePacket({
      body: "# Evidence\n\nAll checks passed.\n",
      issueNumber: 579,
      publisher,
      reference: "docs/agent-evidence/active/579-test.md",
      repository: "voyantjs/voyant",
    })

    assert.equal(
      publication.url,
      "https://artifacts.example.com/agent-evidence/voyantjs/voyant/docs/agent-evidence/active/579-test.md",
    )
    assert.equal(publication.contentType, "text/markdown; charset=utf-8")
    assert.equal(requests.length, 1)
    assert.match(requests[0].url, /agent-artifacts\/agent-evidence\/voyantjs\/voyant/)
    assert.equal(requests[0].init.headers["x-amz-meta-issue"], "579")
  })

  it("includes remote artifact links in browser evidence text", () => {
    assert.match(
      browserEvidenceText({
        artifactPointer: "docs/agent-evidence/browser/579-test/2026-05-10T12-34-56-000Z",
        browserIssues: {
          consoleErrors: 0,
          consoleWarnings: 0,
          failedRequests: 0,
          hasBlockingIssues: false,
        },
        consoleLog: "/workspace/console.jsonl",
        failedRequestLog: "/workspace/network.jsonl",
        remoteArtifactIndex: "https://artifacts.example.com/runs/index.md",
        screenshot: "/workspace/page.png",
        url: "http://127.0.0.1:4879/dashboard",
        viewport: { height: 900, width: 1440 },
      }),
      /remote artifact index: https:\/\/artifacts\.example\.com\/runs\/index\.md/,
    )
  })
})

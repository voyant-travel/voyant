# Evidence Packet: [Task] Validate browser harness against operator template

Issue: https://github.com/voyantjs/voyant/issues/651
Repository: voyantjs/voyant
Branch: task/651-validate-browser-harness-against-operator-template
Workspace: /Users/mihai/builds/internal/voyant-all/voyant/.agent-worktrees/651-validate-browser-harness-against-operator-template
Evidence: docs/agent-evidence/active/651-validate-browser-harness-against-operator-template.md
Handoff state: Human Review
Generated: 2026-05-11T10:31:31.960Z

## Summary

Validated the operator template through the browser evidence runner, added a localhost-only unauthenticated sign-in fallback for evidence capture, made operator typecheck use the repo heap convention, and added a configurable browser navigation wait event for dev servers that keep persistent connections.

## Files Touched

- scripts/agent-runner-capture-browser.mjs
- scripts/lib/agent-runner-browser-evidence.mjs
- scripts/tests/agent-runner-browser-evidence.test.mjs
- templates/operator/package.json
- templates/operator/src/api/auth/handler.ts
- templates/operator/src/lib/current-user.ts
- docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z

## Verification

pnpm --filter operator typecheck: passed; pnpm --filter operator build: passed; pnpm agent:queue:test: passed; pnpm lint:changed: passed; browser capture for /sign-in at 1440x900 and 390x844 with --wait-until load: passed with 0 console errors, 0 console warnings, and 0 failed requests.

## UI Evidence

Browser artifacts: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z
Browser issue summary: 0 console errors, 0 console warnings, 0 failed requests
Blocking browser issues: no

Captures:
- 1440x900: http://127.0.0.1:4951/sign-in
  - Screenshot: ![1440x900 screenshot](docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/screenshots/page-1440x900.png)
  - Video: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/videos/page@36d3a1b5a67defa38b35e46e18e60590.webm
- 390x844: http://127.0.0.1:4951/sign-in
  - Screenshot: ![390x844 screenshot](docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/screenshots/page-390x844.png)
  - Video: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/videos/page@18c323722ca30e08e0c59208d692b1d2.webm

Logs:
- Summary: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/summary.json
- Console log: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/console.jsonl
- Failed-request log: docs/agent-evidence/browser/651-validate-browser-harness-against-operator-template/2026-05-11T10-30-11-222Z/network.jsonl

## Links

- PR: Not provided.
- CI: Not provided.
- Logs: Not provided.

## Residual Risks

The operator proof uses an ignored worktree-local .dev.vars binding so Cloudflare dev exposes VOYANT_OPERATOR_BROWSER_EVIDENCE to the worker.

## Security Considerations

No auth bypass is introduced. The evidence flag only returns unauthenticated public sign-in bootstrap responses for localhost/127.0.0.1 requests and does not grant a user session.

## Notes

No additional notes.

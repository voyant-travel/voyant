# Evidence Packet: [Task] Validate browser harness against workflows dashboard

Issue: https://github.com/voyant-travel/voyant/issues/648
Repository: voyant-travel/voyant
Branch: task/648-validate-browser-harness-against-workflows-dashboard
Workspace: /Users/mihai/builds/internal/voyant-all/voyant/.agent-worktrees/648-validate-browser-harness-against-workflows-dashboard
Evidence: docs/agent-evidence/active/648-validate-browser-harness-against-workflows-dashboard.md
Handoff state: Human Review
Generated: 2026-05-11T09:06:46.590Z

## Summary

Added an opt-in empty API fallback for workflows dashboard Vite dev smoke tests and tightened the dashboard layout so browser evidence captures cleanly at desktop and mobile widths.

## Files Touched

- apps/workflows-local-dashboard/vite.config.ts
- apps/workflows-local-dashboard/README.md
- apps/workflows-local-dashboard/src/main.tsx
- apps/workflows-local-dashboard/src/components/app-header.tsx
- apps/workflows-local-dashboard/src/components/app-sidebar.tsx
- apps/workflows-local-dashboard/src/components/runs-table.tsx
- docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z

## Verification

pnpm -F @voyant-travel/workflows-local-dashboard check-types: passed; pnpm -F @voyant-travel/workflows-local-dashboard build: passed; pnpm agent:queue:capture-browser with 1440x900 and 390x844 viewports: passed with 0 console errors, 0 console warnings, and 0 failed requests.

## UI Evidence

Browser artifacts: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z
Browser issue summary: 0 console errors, 0 console warnings, 0 failed requests
Blocking browser issues: no

Captures:
- 1440x900: http://127.0.0.1:4948
  - Screenshot: ![1440x900 screenshot](docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/screenshots/page-1440x900.png)
  - Video: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/videos/page@59b105e4b9b1c795adc625fc0fd9604e.webm
- 390x844: http://127.0.0.1:4948
  - Screenshot: ![390x844 screenshot](docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/screenshots/page-390x844.png)
  - Video: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/videos/page@c958d08582edc05b7afd57b75b0236aa.webm

Logs:
- Summary: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/summary.json
- Console log: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/console.jsonl
- Failed-request log: docs/agent-evidence/browser/648-validate-browser-harness-against-workflows-dashboard/2026-05-11T09-06-06-927Z/network.jsonl

## Links

- PR: Not provided.
- CI: Not provided.
- Logs: Not provided.

## Residual Risks

No known residual risks provided.

## Security Considerations

No security-sensitive changes reported.

## Notes

No additional notes.

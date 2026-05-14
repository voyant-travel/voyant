---
"@voyantjs/auth": minor
"@voyantjs/auth-react": minor
"@voyantjs/auth-ui": minor
"@voyantjs/hono": minor
"@voyantjs/core": minor
---

Add first-class API token rotation and audit-facing token context. The auth facade now supports `POST /auth/api-tokens/:keyId/rotate`, the React hooks and UI expose rotation, and Hono request context includes `apiTokenId` for downstream audit log writers.

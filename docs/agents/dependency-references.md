# Dependency References

Use current primary documentation for third-party dependencies. Do not rely on
model memory for fast-moving APIs.

Before applying guidance:

1. Check the version installed in this repository.
2. Prefer official docs, changelogs, migration guides, and `llms.txt` sources.
3. Follow repo conventions when docs and local architecture disagree; flag the
   conflict in the evidence packet.
4. Do not upgrade dependencies unless the task explicitly requires it.

## High-Risk References

| Dependency | Reference |
| --- | --- |
| Better Auth | https://www.better-auth.com/docs |
| Better Auth llms | https://www.better-auth.com/llms.txt |
| WorkOS | https://workos.com/docs |
| Hono | https://hono.dev/docs |
| Drizzle | https://orm.drizzle.team/docs |
| Cloudflare Workers | https://developers.cloudflare.com/workers/ |
| Cloudflare Queues | https://developers.cloudflare.com/queues/ |
| Cloudflare Durable Objects | https://developers.cloudflare.com/durable-objects/ |
| Cloudflare R2 | https://developers.cloudflare.com/r2/ |
| shadcn/ui | https://ui.shadcn.com/docs |
| Payload | https://payloadcms.com/docs |
| Sanity | https://www.sanity.io/docs |
| Trigger.dev | https://trigger.dev/docs |
| OpenAI Codex | https://developers.openai.com/codex/ |

Use installed skills for Better Auth, WorkOS, Trigger.dev, Payload, shadcn/ui,
and OpenAI docs when available. Add more references here when a dependency
becomes a repeated source of agent mistakes.

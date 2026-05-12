---
"@voyantjs/ui": minor
---

Breaking change: `@voyantjs/ui` now declares `recharts` as a peer dependency instead of installing its own runtime copy, so chart wrappers share the consuming app's Recharts instance and avoid duplicate chart context.

Consumers that use `@voyantjs/ui/components` or any chart primitives must install `recharts` directly, for example `pnpm add recharts@^3.0.0`. If chart cards render headers with blank bodies, run `pnpm -r why recharts` and confirm the app resolves a single Recharts version.

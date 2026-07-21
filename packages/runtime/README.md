# `@voyant-travel/runtime`

The public Node host for a generated Voyant project. Applications normally use
`createVoyantProjectServerEntry()` for their server entry, while the external
Voyant CLI uses `startVoyantProject()` for `voyant start`.

This package owns graph admission, runtime composition, API and admin hosting,
package-owned job dispatch, and deployment resources. Low-level HTTP and
storage primitives live in `@voyant-travel/runtime-core`; application starters
should not depend on that package directly.

Command parsing and executable entry points belong to
[`voyant-travel/cli`](https://github.com/voyant-travel/cli), not this package.

## Project tooling

The versioned `@voyant-travel/runtime/tooling` subpath owns the standard
operator application's Vite and TanStack Start lifecycle. CLI packages provide
command parsing, prepare the project graph under `.voyant`, and call this API.

```ts
import {
  buildVoyantProject,
  developVoyantProject,
} from "@voyant-travel/runtime/tooling"

await buildVoyantProject({ projectRoot: process.cwd() })

const development = await developVoyantProject({
  projectRoot: process.cwd(),
  host: "127.0.0.1",
  port: 3300,
})

console.log(development.url)
await development.close()
```

`buildVoyantProject()` reads the selected product distribution from
`.voyant/product-bom.generated.json`, generates its package-owned routes from
the project-installed `./standard-route-files` export, runs the complete Node
SSR build, and copies `.voyant` to both `dist/.voyant` and
`dist/server/.voyant`. `developVoyantProject()` starts Vite's SSR development
server and defaults to port `3300`.

The build always uses the project's `src/server.ts` or generates an equivalent
`.voyant/app/server.ts`. That entry exports both TanStack's request handler and
the bundled Node `start` function. Production `voyant start` loads this built
entry so TanStack virtual modules and the React SSR singleton remain inside the
Vite-generated server graph; it must not reconstruct SSR from package source.

Projects may add an optional root `vite.config.ts`. Vite loads and merges it for
both development and production builds, so project-specific plugins and normal
Vite options require no lifecycle-script changes. Voyant's inline configuration
remains authoritative for the generated routes, TanStack Start application,
React integration, Node SSR target, and `dist` output root. Projects must not
set `build.outDir`: the Node server, client assets, and generated deployment
artifacts use the fixed `dist/server`, `dist/client`, and `dist/.voyant` layout.

```bash
pnpm add -D vite vite-plugin-inspect
```

```ts
import { defineConfig } from "vite"
import inspect from "vite-plugin-inspect"

export default defineConfig({
  plugins: [inspect()],
})
```

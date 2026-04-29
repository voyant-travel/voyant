# @voyantjs/core

Module system and framework primitives for Voyant. Transport-agnostic —
provides the contracts, registry, container, event bus, links, query,
workflows, optional plugin bundles, and config shape that every Voyant module
and transport adapter builds on.

## Install

```bash
pnpm add @voyantjs/core
```

## Usage

```typescript
import { defineModule } from "@voyantjs/core/module"
import { defineLink } from "@voyantjs/core/links"
import { definePlugin } from "@voyantjs/core/plugin"
import { defineVoyantConfig } from "@voyantjs/core/config"
import { createWorkflow, step } from "@voyantjs/core/workflows"
```

In Voyant, modules, providers, extensions, and workflows are the main runtime
primitives. Plugins are optional distribution bundles that package those pieces
together for reuse across projects when a broader bundle is helpful.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./module` | `Module`, `defineModule` |
| `./registry` | Module registry |
| `./container` | `createContainer` dependency container |
| `./events` | `createEventBus` in-process event bus |
| `./hooks` | Lifecycle hook contracts |
| `./orchestration` | `JobRunner` interface for background jobs |
| `./links` | Module Links — `defineLink`, `generateLinkTableSql`, `LinkService` |
| `./query` | Cross-module reads — `queryGraph`, `createQueryContext` |
| `./workflows` | In-process saga primitive with compensation |
| `./plugin` | Plugin bundles — `definePlugin`, `registerPlugins` |
| `./config` | `VoyantConfig` manifest shape + `defineVoyantConfig` |
| `./env` | Environment helpers |

## License

Apache-2.0

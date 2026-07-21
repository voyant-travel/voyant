# @voyant-travel/core

Module system and framework primitives for Voyant. Transport-agnostic —
provides the contracts, registry, container, event bus, links, query,
sagas, and optional plugin bundles that every Voyant module and transport
adapter builds on.

## Install

```bash
pnpm add @voyant-travel/core
```

## Usage

```typescript
import type { Module } from "@voyant-travel/core/module"
import { defineLink } from "@voyant-travel/core/links"
import { definePlugin } from "@voyant-travel/core/plugin"
import { defineModule } from "@voyant-travel/core/project"
import { createSaga, sagaStep } from "@voyant-travel/core/saga"
```

In Voyant, modules, providers, extensions, subscribers, and jobs are the main
runtime primitives. Plugins are optional distribution bundles that package those pieces
together for reuse across projects when a broader bundle is helpful.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Barrel re-exports |
| `./module` | Runtime `Module` and `Extension` contracts |
| `./registry` | Module registry |
| `./container` | `createContainer` dependency container |
| `./events` | `createEventBus` in-process event bus |
| `./hooks` | Lifecycle hook contracts |
| `./links` | Module Links — `defineLink`, `generateLinkTableSql`, `LinkService` |
| `./query` | Cross-module reads — `queryGraph`, `createQueryContext` |
| `./saga` | In-process domain saga primitive with compensation |
| `./plugin` | Plugin bundles — `definePlugin`, `registerPlugins` |
| `./project` | Import-cheap package-owned deployment manifests |
| `./env` | Environment helpers |

## License

Apache-2.0

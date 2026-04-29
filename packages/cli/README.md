# @voyantjs/cli

The `voyant` CLI. Scaffolding, code generation, config loading, database commands, and a TypeScript script runner with native strip-types.

## Install

```bash
pnpm add -D @voyantjs/cli
```

Or as a global install:

```bash
npm install -g @voyantjs/cli
```

Built-in starters can be referenced by name:

```bash
voyant new my-app --template dmc
voyant new my-app --template operator
```

Built-in starters are downloaded from the matching GitHub Release for the installed CLI version.

You can also point at a custom local template directory:

```bash
voyant new my-app --template ./templates/custom
```

## Commands

| Command | Description |
| --- | --- |
| `voyant new <name> [--template <name\|path>] [--force]` | Clone a built-in or custom template into a new directory |
| `voyant generate module <name> [--dir <path>]` | Scaffold a new module package (schema, validation, service, routes) |
| `voyant generate link <a.entity> <b.entity>` | Print a `defineLink` snippet |
| `voyant config <show\|validate\|path> [--path <file>]` | Load + inspect `voyant.config.ts` |
| `voyant db <generate\|migrate\|studio\|push\|check>` | Drizzle-kit subcommands for the DMC template |
| `voyant db sync-links [--links <path>] [--out <file>]` | Emit DDL for link pivot tables |
| `voyant exec <script.ts> [args...]` | Run a TS script with native strip-types + extensionless imports |
| `voyant --help` | Print usage |

Requires Node 22.6+ for native TypeScript strip-types.

## Exports

| Entry | Description |
| --- | --- |
| `.` | CLI `main(argv, ctx)` entry point |
| `./commands/*` | Individual command handlers |
| `./lib/strings` | `toKebabCase`, `toCamelCase`, `toPascalCase` |
| `./lib/args` | Hand-rolled arg parser |
| `./lib/config-loader` | `voyant.config.*` loader |

## License

Apache-2.0

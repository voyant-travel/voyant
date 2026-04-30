# @voyantjs/cli — moved

> **The `@voyantjs/cli` package now ships from a separate repo:**
> [github.com/voyantjs/cli](https://github.com/voyantjs/cli)
>
> Install via `npm install -g @voyantjs/cli`. Versions `0.19.0` and later are
> published from there.

## Why this folder still exists

This in-monorepo copy stays as a `private: true` workspace package so that
internal consumers — `templates/dmc`'s `drizzle.config.ts`, the `voyant`
binary used during framework development, etc. — can keep importing
`@voyantjs/cli` and `@voyantjs/cli/drizzle` via `workspace:*`. It is no
longer published to npm.

## Working on the CLI

If you want to add or change a CLI command, do it in the new repo:

```sh
git clone https://github.com/voyantjs/cli
cd cli
pnpm install
pnpm test
```

## License

Apache-2.0

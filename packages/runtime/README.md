# `@voyant-travel/runtime`

The public Node host for a generated Voyant project. Applications normally use
`createVoyantProjectServerEntry()` for their server entry, while the external
Voyant CLI uses `startVoyantProject()` for `voyant start`.

This package owns graph admission, runtime composition, API and admin hosting,
scheduled workflow dispatch, and deployment resources. Low-level HTTP and
storage primitives live in `@voyant-travel/runtime-core`; application starters
should not depend on that package directly.

Command parsing and executable entry points belong to
[`voyant-travel/cli`](https://github.com/voyant-travel/cli), not this package.

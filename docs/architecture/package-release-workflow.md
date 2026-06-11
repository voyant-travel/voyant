# Package Release Workflow

Voyant packages are published independently, with small fixed cohorts only where
the package names represent one installable module surface.

## Rules

- Do not put every publishable package on one global release train.
- Use Changesets `fixed` cohorts for module runtime surfaces that should move
  together, for example `@voyantjs/bookings`, `@voyantjs/bookings-react`, and
  `@voyantjs/bookings-react/ui`.
- Keep `*-contracts` packages independently versioned. Contract package versions
  describe contract changes, not unrelated runtime or UI churn.
- Use `workspace:^` for internal `@voyantjs/*` dependencies. Patch releases
  should not force compatible dependents to publish; minor and major releases
  still propagate when they leave the dependent's range.
- Build and verify only the package set that will be published, plus the build
  dependencies Turbo needs for those packages.
- Starter GitHub Releases are separate from npm package publication. Refresh
  starter assets through the manual release workflow with an explicit starter
  release version.

## Release Flow

On pushes to `main`, the release workflow plans work before building:

1. If package versions are ahead of npm, build the pending package set with
   Turbo filters.
2. Verify exports and publish tarballs for the same pending package set.
3. Publish those pending packages through Changesets.
4. If releasable changesets exist, create or update the Changesets release PR
   without building the package graph.

Pending publication and release PR creation may happen in the same run. This
keeps routine module patches local, avoids starving already-versioned packages
when new changesets land, and preserves broad propagation when a dependency
version leaves a compatible range.

# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI and npm releases.

## Workflows Overview

### `ci.yml`

Runs the main repository checks for pull requests and pushes to `main` and `develop`:

- lint
- typecheck
- test
- architecture checks
- package export checks
- i18n checks

### `release.yml`

Handles package releases:

- normal Changesets release flow on pushes to `main`
- scoped npm publication for packages whose checked-in versions are not yet on npm
- manual GitHub release + starter asset refresh for an explicit starter release version
- npm Trusted Publishing via GitHub Actions OIDC
- versioned starter tarballs attached to each GitHub Release for CLI scaffolding

Notes:

- the push flow publishes packages whose local version is ahead of npm, then creates Changesets release PRs without building the package graph
- the publish path builds and verifies only the pending package set and their build dependencies
- pending package publication and release PR creation can happen in the same run, so unpublished versions are not blocked by newly landed changesets
- starter GitHub Releases are separate from npm package publication; run the manual dispatch with `release_assets=true` and an explicit `release_version` to create or refresh starter archives
- package publishing may still create package tags, but GitHub Releases are intended for starter assets rather than every npm package release

## Required GitHub Secrets

No npm publish token is required when Trusted Publishing is configured.

## Notes

- Database migrations are intentionally not automated in GitHub Actions for this repository.
- Schema and migration work should be generated, reviewed, and applied explicitly by maintainers.

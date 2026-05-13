# @voyantjs/workflows

## 0.40.0

## 0.39.0

## 0.38.2

## 0.38.1

## 0.38.0

### Minor Changes

- 885afc8: Consolidate the public workflows package surface around `@voyantjs/workflows`
  subpaths and `@voyantjs/workflows-ui`.

  Use `@voyantjs/workflows/errors`, `@voyantjs/workflows/config`, and
  `@voyantjs/workflows/bindings` instead of the former one-file packages. Use
  `@voyantjs/workflows-ui` instead of `@voyantjs/workflow-runs-ui`.

## 0.37.1

### Patch Changes

- @voyantjs/workflows-errors@0.37.1

## 0.37.0

### Patch Changes

- @voyantjs/workflows-errors@0.37.0

## 0.36.0

### Patch Changes

- @voyantjs/workflows-errors@0.36.0

## 0.35.0

### Patch Changes

- @voyantjs/workflows-errors@0.35.0

## 0.34.0

### Patch Changes

- @voyantjs/workflows-errors@0.34.0

## 0.33.1

### Patch Changes

- @voyantjs/workflows-errors@0.33.1

## 0.33.0

### Patch Changes

- @voyantjs/workflows-errors@0.33.0

## 0.32.3

### Patch Changes

- @voyantjs/workflows-errors@0.32.3

## 0.32.2

### Patch Changes

- @voyantjs/workflows-errors@0.32.2

## 0.32.1

### Patch Changes

- @voyantjs/workflows-errors@0.32.1

## 0.32.0

### Patch Changes

- @voyantjs/workflows-errors@0.32.0

## 0.31.4

### Patch Changes

- @voyantjs/workflows-errors@0.31.4

## 0.31.3

### Patch Changes

- @voyantjs/workflows-errors@0.31.3

## 0.31.2

### Patch Changes

- @voyantjs/workflows-errors@0.31.2

## 0.31.1

### Patch Changes

- @voyantjs/workflows-errors@0.31.1

## 0.31.0

### Patch Changes

- @voyantjs/workflows-errors@0.31.0

## 0.30.7

### Patch Changes

- @voyantjs/workflows-errors@0.30.7

## 0.30.6

### Patch Changes

- @voyantjs/workflows-errors@0.30.6

## 0.30.5

### Patch Changes

- 3f323e9: Serialize workflow concurrency declarations into runtime manifests and enforce workflow concurrency policies for the in-memory, Node, and Cloudflare orchestrator drivers.
  - @voyantjs/workflows-errors@0.30.5

## 0.30.4

### Patch Changes

- @voyantjs/workflows-errors@0.30.4

## 0.30.3

### Patch Changes

- 05a1b19: Serialize workflow schedule declarations into manifests, preserve schedule config when Hono registers runtime manifests, and expose shared schedule fire-time helpers from the orchestrator package.
  - @voyantjs/workflows-errors@0.30.3

## 0.30.2

### Patch Changes

- @voyantjs/workflows-errors@0.30.2

## 0.30.1

### Patch Changes

- @voyantjs/workflows-errors@0.30.1

## 0.30.0

### Patch Changes

- @voyantjs/workflows-errors@0.30.0

## 0.29.0

### Patch Changes

- @voyantjs/workflows-errors@0.29.0

## 0.28.3

### Patch Changes

- @voyantjs/workflows-errors@0.28.3

## 0.28.2

### Patch Changes

- @voyantjs/workflows-errors@0.28.2

## 0.28.1

### Patch Changes

- @voyantjs/workflows-errors@0.28.1

## 0.28.0

### Patch Changes

- @voyantjs/workflows-errors@0.28.0

## 0.27.0

### Patch Changes

- @voyantjs/workflows-errors@0.27.0

## 0.26.9

### Patch Changes

- @voyantjs/workflows-errors@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/workflows-errors@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/workflows-errors@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/workflows-errors@0.26.6

## 0.26.5

### Patch Changes

- @voyantjs/workflows-errors@0.26.5

## 0.26.4

### Patch Changes

- @voyantjs/workflows-errors@0.26.4

## 0.26.3

### Patch Changes

- @voyantjs/workflows-errors@0.26.3

## 0.26.2

### Patch Changes

- @voyantjs/workflows-errors@0.26.2

## 0.26.1

### Patch Changes

- @voyantjs/workflows-errors@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/workflows-errors@0.26.0

## 0.25.0

### Patch Changes

- @voyantjs/workflows-errors@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/workflows-errors@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/workflows-errors@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/workflows-errors@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/workflows-errors@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/workflows-errors@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/workflows-errors@0.22.0

## 0.21.1

### Patch Changes

- @voyantjs/workflows-errors@0.21.1

## 0.21.0

### Patch Changes

- @voyantjs/workflows-errors@0.21.0

## 0.20.0

### Patch Changes

- @voyantjs/workflows-errors@0.20.0

## 0.19.0

### Patch Changes

- @voyantjs/workflows-errors@0.19.0

## 0.18.0

### Patch Changes

- @voyantjs/workflows-errors@0.18.0

## 0.17.0

### Patch Changes

- 66d722d: De-flake the `ctx.parallel > defaults concurrency to total items` test by asserting on elapsed time (`elapsed < SLEEP_MS * ITEMS.length`) instead of completion order. Sleep-based ordering tests are fragile under CI runner scheduler resolution; the elapsed-time invariant verifies the actual contract (real concurrency, not serialized) without relying on `setTimeout` precision.
  - @voyantjs/workflows-errors@0.17.0

## 0.16.0

### Patch Changes

- @voyantjs/workflows-errors@0.16.0

## 0.15.0

### Patch Changes

- @voyantjs/workflows-errors@0.15.0

## 0.14.0

### Patch Changes

- @voyantjs/workflows-errors@0.14.0

## 0.13.0

### Patch Changes

- @voyantjs/workflows-errors@0.13.0

## 0.12.0

### Patch Changes

- @voyantjs/workflows-errors@0.12.0

## 0.11.0

### Patch Changes

- @voyantjs/workflows-errors@0.11.0

## 0.10.0

### Patch Changes

- @voyantjs/workflows-errors@0.10.0

## 0.9.0

### Patch Changes

- @voyantjs/workflows-errors@0.9.0

## 0.8.0

### Patch Changes

- @voyantjs/workflows-errors@0.8.0

## 0.7.0

### Patch Changes

- @voyantjs/workflows-errors@0.7.0

## 0.6.9

### Patch Changes

- @voyantjs/workflows-errors@0.6.9

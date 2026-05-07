# @voyantjs/workflow-runs

## 0.26.9

### Patch Changes

- @voyantjs/core@0.26.9
- @voyantjs/db@0.26.9
- @voyantjs/hono@0.26.9

## 0.26.8

### Patch Changes

- @voyantjs/core@0.26.8
- @voyantjs/db@0.26.8
- @voyantjs/hono@0.26.8

## 0.26.7

### Patch Changes

- @voyantjs/core@0.26.7
- @voyantjs/db@0.26.7
- @voyantjs/hono@0.26.7

## 0.26.6

### Patch Changes

- @voyantjs/core@0.26.6
- @voyantjs/db@0.26.6
- @voyantjs/hono@0.26.6

## 0.26.5

### Patch Changes

- Updated dependencies [7a92aba]
  - @voyantjs/core@0.26.5
  - @voyantjs/db@0.26.5
  - @voyantjs/hono@0.26.5

## 0.26.4

### Patch Changes

- Updated dependencies [6493f62]
  - @voyantjs/core@0.26.4
  - @voyantjs/db@0.26.4
  - @voyantjs/hono@0.26.4

## 0.26.3

### Patch Changes

- Updated dependencies [372cad5]
  - @voyantjs/core@0.26.3
  - @voyantjs/db@0.26.3
  - @voyantjs/hono@0.26.3

## 0.26.2

### Patch Changes

- Updated dependencies [ffdb485]
  - @voyantjs/core@0.26.2
  - @voyantjs/db@0.26.2
  - @voyantjs/hono@0.26.2

## 0.26.1

### Patch Changes

- Updated dependencies [c0507a6]
  - @voyantjs/core@0.26.1
  - @voyantjs/db@0.26.1
  - @voyantjs/hono@0.26.1

## 0.26.0

### Patch Changes

- @voyantjs/core@0.26.0
- @voyantjs/db@0.26.0
- @voyantjs/hono@0.26.0

## 0.25.0

### Minor Changes

- f73e32c: Add a supported self-host failed-step resume path for workflow-run dispatch.

  The Node self-host server now exposes a resume endpoint that can start a new run
  from a stored self-host parent snapshot or from an external admin recorder parent
  id with explicit `workflowId`, `resumeFromStep`, and seeded step results. The
  orchestrator can now trigger runs with a pre-populated journal, and the Node
  self-host package exports a client helper for operator admin integrations.

### Patch Changes

- @voyantjs/core@0.25.0
- @voyantjs/db@0.25.0
- @voyantjs/hono@0.25.0

## 0.24.3

### Patch Changes

- @voyantjs/core@0.24.3
- @voyantjs/db@0.24.3
- @voyantjs/hono@0.24.3

## 0.24.2

### Patch Changes

- @voyantjs/core@0.24.2
- @voyantjs/db@0.24.2
- @voyantjs/hono@0.24.2

## 0.24.1

### Patch Changes

- @voyantjs/core@0.24.1
- @voyantjs/db@0.24.1
- @voyantjs/hono@0.24.1

## 0.24.0

### Patch Changes

- @voyantjs/core@0.24.0
- @voyantjs/db@0.24.0
- @voyantjs/hono@0.24.0

## 0.23.0

### Patch Changes

- @voyantjs/core@0.23.0
- @voyantjs/db@0.23.0
- @voyantjs/hono@0.23.0

## 0.22.0

### Patch Changes

- @voyantjs/core@0.22.0
- @voyantjs/db@0.22.0
- @voyantjs/hono@0.22.0

## 0.21.1

### Patch Changes

- Republish workflow-runs through the pnpm release pipeline so the packed manifest points exports at `dist` and replaces internal `workspace:*` dependencies with concrete versions.
  - @voyantjs/core@0.21.1
  - @voyantjs/db@0.21.1
  - @voyantjs/hono@0.21.1

## 0.21.0

### Patch Changes

- Updated dependencies [6427bad]
  - @voyantjs/core@0.21.0
  - @voyantjs/db@0.21.0
  - @voyantjs/hono@0.21.0

# @voyantjs/workflows

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

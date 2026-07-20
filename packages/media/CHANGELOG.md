# @voyant-travel/media

## 0.4.0

### Minor Changes

- f0f51b4: Add the Media library admin navigation surface. The media deployment manifest
  now declares an `admin` block with a runtime factory, route, and navigation
  entry, and `@voyant-travel/media-react/admin` exposes
  `createSelectedMediaAdminExtension`, which contributes a "Media library"
  navigation item plus a route that renders the `<MediaLibrary>` browse surface.
  The operator navigation catalogue gains the `mediaLibrary` label in English and
  Romanian.

## 0.3.0

### Minor Changes

- 05aa1d5: Mount the media-library admin surface into the standard operator distribution.
  The media package now ships a deployment manifest and graph runtime factory that
  resolve the `"media"` object-storage provider through the storage runtime port
  and inject it into the media-library routes, and the standard operator
  distribution selects the module so `/v1/admin/media-library/*` is served.

### Patch Changes

- 05aa1d5: Declare the media module's `meta.agentTools` posture as `not-applicable`. The
  media library exposes an admin catalogue surface only; byte upload/serve
  mechanics and any future media Tools remain owned by `@voyant-travel/storage`,
  so the module carries no agent Tools. This satisfies the agent-tool-coverage
  check, which requires every Tool-less module to declare an explicit posture and
  rationale.
- 05aa1d5: Exclude test files from the build so `dist` no longer emits `*.test.*` outputs.

## 0.2.2

### Patch Changes

- Updated dependencies [b320e4f]
  - @voyant-travel/hono@0.132.0

## 0.2.1

### Patch Changes

- Updated dependencies [bcd7ad0]
  - @voyant-travel/storage@0.112.0

## 0.2.0

### Minor Changes

- 819bf6b: Scaffold the `@voyant-travel/media` library foundation: the `media_asset`,
  `media_folder`, `media_folder_member`, and `asset_usage` schema, a
  transport-agnostic service (content-checksum dedup, list/search, folder CRUD +
  membership, usage tracking with a delete-in-use guard), and the media library
  admin API routes under `/v1/admin/media-library/*`, all built on
  the existing `@voyant-travel/storage` byte seam. Backend/domain foundation only.

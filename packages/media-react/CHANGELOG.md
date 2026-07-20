# @voyant-travel/media-react

## 0.3.1

### Patch Changes

- 4b225b1: Polish the media library layout. Add standard page padding (`p-6`) to the
  browse surface so it no longer sits flush against the shell edges, and move the
  asset detail/edit form out of a permanent inline right column into a right-side
  sheet that opens when an asset is selected and closes back to the grid. This
  reclaims the horizontal space the empty "Select an asset" column wasted and
  gives the edit form more room.

## 0.3.0

### Minor Changes

- f0f51b4: Add the Media library admin navigation surface. The media deployment manifest
  now declares an `admin` block with a runtime factory, route, and navigation
  entry, and `@voyant-travel/media-react/admin` exposes
  `createSelectedMediaAdminExtension`, which contributes a "Media library"
  navigation item plus a route that renders the `<MediaLibrary>` browse surface.
  The operator navigation catalogue gains the `mediaLibrary` label in English and
  Romanian.

### Patch Changes

- Updated dependencies [f0f51b4]
  - @voyant-travel/media@0.4.0
  - @voyant-travel/i18n@0.116.0
  - @voyant-travel/admin@0.128.3

## 0.2.1

### Patch Changes

- 05aa1d5: Exclude test files from the build so `dist` no longer emits `*.test.*` outputs.
- Updated dependencies [05aa1d5]
- Updated dependencies [05aa1d5]
- Updated dependencies [05aa1d5]
  - @voyant-travel/media@0.3.0

## 0.2.0

### Minor Changes

- 3bac6e6: Add `@voyant-travel/media-react` — the React client for the consolidated media
  library. The package ships a zod fetch client and TanStack Query hooks over the
  media library API (`/v1/admin/media-library/*`, served by
  `@voyant-travel/media`), reusing that package's request/validation schemas.

  It provides two browse surfaces:

  - `<MediaLibrary>` — the full admin browse experience: folder rail, filters
    (type, tag, format, name search), an upload dropzone that writes into the
    library, a grid/list toggle, and a detail panel for renaming, editing alt
    text and tags, folder membership, and a "where used" view. Deleting an asset
    that is still in use surfaces the service's guard clearly.
  - `<MediaPicker>` — a host-agnostic single/multi-select picker other surfaces
    can embed, with a type filter, search, inline upload that lands in the library
    and auto-selects, and an `onSelect(assets)` callback.

  Hooks: `useMediaAssets`, `useMediaAsset`, `useAssetUpload`, `useUpdateAsset`,
  `useDeleteAsset`, `useFolders`, `useFolderMutation`, and `useAssetUsage`, plus
  an English/Romanian message catalog. This is a standalone package; wiring the
  routes into the operator and embedding the picker into product media are
  follow-up slices.

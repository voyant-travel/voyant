# @voyant-travel/notifications-react

The notifications client tier: headless data hooks/clients plus the styled UI
components and admin pages (formerly `@voyant-travel/notifications-ui`).

Headless consumers import from the root, `./hooks`, or `./client` — these pull
no styling peers. Styled surfaces live under `./ui`, `./components/*`,
`./admin`, `./i18n`, and `./styles.css`, whose heavier peers (`@voyant-travel/ui`,
`@voyant-travel/admin`, `lucide-react`, `react-hook-form`) are optional and only
needed when you import those subpaths.

React components for Voyant notifications: reminder sequence editor (stages + channels), notification settings, and preview.

## Install

```bash
pnpm add @voyant-travel/notifications-react @voyant-travel/ui @tanstack/react-query react react-dom
```

```ts
import "@voyant-travel/notifications-react/styles.css"
```

## Components

- `<StageList />` — reminder rule's ordered stages with reorder + delete.
- `<StageEditorDialog />` — create / edit a stage (anchor, window, cadence).
- `<StageChannelEditorDialog />` — create / edit a channel under a stage.
- `<NotificationSettingsForm />` — quiet hours, blackout dates, weekend skip, recipient rate limit, suppression window.
- `<RemindersPreviewList />` — what would fire on a given date with reasoning.

# @voyantjs/notifications-ui

React components for Voyant notifications: reminder sequence editor (stages + channels), notification settings, and preview.

## Install

```bash
pnpm add @voyantjs/notifications-ui @voyantjs/notifications-react @voyantjs/ui @tanstack/react-query react react-dom
```

```ts
import "@voyantjs/notifications-ui/styles.css"
```

## Components

- `<StageList />` — reminder rule's ordered stages with reorder + delete.
- `<StageEditorDialog />` — create / edit a stage (anchor, window, cadence).
- `<StageChannelEditorDialog />` — create / edit a channel under a stage.
- `<NotificationSettingsForm />` — quiet hours, blackout dates, weekend skip, recipient rate limit, suppression window.
- `<RemindersPreviewList />` — what would fire on a given date with reasoning.

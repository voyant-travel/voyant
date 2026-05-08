import type { NotificationsUiMessages } from "./messages.js"

export const notificationsUiEn: NotificationsUiMessages = {
  common: {
    cancel: "Cancel",
    save: "Save",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    add: "Add",
    none: "—",
    loading: "Loading…",
    optionalPlaceholder: "Optional",
  },
  stage: {
    listHeading: "Stages",
    listEmpty: "No stages yet. Add one to define when this rule fires.",
    addStage: "Add stage",
    deleteConfirm: "Delete this stage?",
    fields: {
      name: "Name",
      orderIndex: "Order",
      anchor: "Anchor",
      windowStartDays: "Window start (days)",
      windowEndDays: "Window end (days)",
      cadenceKind: "Cadence",
      cadenceEveryDays: "Every N days",
      cadenceIntervals: "Escalation buckets",
      maxSendsInStage: "Max sends in stage",
      respectQuietHours: "Respect quiet hours",
    },
    placeholders: {
      name: "First reminder",
    },
    anchors: {
      due_date: "Due date",
      booking_created_at: "Booking created at",
      departure_date: "Departure date",
      invoice_issued_at: "Invoice issued at",
      last_send_at: "Last send",
    },
    cadences: {
      once: "Once",
      every_n_days: "Every N days",
      escalating: "Escalating buckets",
    },
    intervalRow: {
      whenDaysUntilDueGT: "When days-until-due >",
      whenDaysUntilDueLT: "When days-until-due <",
      repeatEveryDays: "Repeat every (days)",
      addInterval: "Add bucket",
      removeInterval: "Remove",
    },
    titles: {
      create: "Add stage",
      edit: "Edit stage",
    },
  },
  channel: {
    listHeading: "Channels",
    listEmpty: "No channels yet. Add at least one for this stage to deliver.",
    addChannel: "Add channel",
    deleteConfirm: "Delete this channel?",
    fields: {
      orderIndex: "Order",
      channel: "Channel",
      provider: "Provider",
      templateId: "Template",
      templateSlug: "Template slug",
      recipientKind: "Recipient kind",
      recipientRole: "Recipient role",
    },
    channels: {
      email: "Email",
      sms: "SMS",
    },
    recipientKinds: {
      primary: "Primary",
      cc: "CC",
      bcc: "BCC",
    },
    titles: {
      create: "Add channel",
      edit: "Edit channel",
    },
  },
  settings: {
    heading: "Notification settings",
    description: "Tenant-wide defaults for quiet hours, blackouts, and per-recipient rate limits.",
    sections: {
      quietHours: "Quiet hours",
      quietHoursDesc: "When reminders are eligible to send, in the recipient's timezone.",
      blackouts: "Blackout dates",
      blackoutsDesc: "Specific dates to skip entirely (holidays, company closures).",
      rateLimits: "Rate limits & dedup",
      rateLimitsDesc: "Caps that apply across all rules to protect recipients from spam.",
    },
    fields: {
      quietHoursStart: "Start",
      quietHoursEnd: "End",
      quietHoursTz: "Timezone",
      blackoutDates: "Blackout dates",
      skipWeekends: "Skip weekends",
      skipWeekendsDesc: "Defer reminders that would land on Saturday or Sunday.",
      recipientRateLimitPerDay: "Per-recipient daily cap",
      suppressionWindowHours: "Suppression window (hours)",
    },
    placeholders: {
      tz: "Search timezones…",
      noBlackouts: "No blackout dates yet.",
    },
    helpers: {
      blackoutDates: "Add a date for each calendar day to skip.",
      recipientRateLimitPerDay:
        "Maximum sent reminders per recipient per channel per 24h. Leave blank for no limit.",
      suppressionWindowHours: "Window for suppression group dedup across rules sharing a tag.",
    },
    actions: {
      addBlackoutDate: "Add date",
      removeBlackoutDate: "Remove",
    },
  },
  preview: {
    heading: "Preview reminders",
    description:
      "Read-only — shows which (rule, stage, target) combinations would fire on the chosen date.",
    dateLabel: "Date",
    refresh: "Refresh",
    empty: "Nothing would fire on this date.",
    columns: {
      rule: "Rule",
      stage: "Stage",
      target: "Target",
      anchor: "Anchor",
      scheduledAt: "Scheduled at",
      reasoning: "Reasoning",
    },
  },
}

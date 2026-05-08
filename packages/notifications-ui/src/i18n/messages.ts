export type NotificationsUiMessages = {
  common: {
    cancel: string
    save: string
    create: string
    edit: string
    delete: string
    add: string
    none: string
    loading: string
    optionalPlaceholder: string
  }
  stage: {
    listHeading: string
    listEmpty: string
    addStage: string
    deleteConfirm: string
    fields: {
      name: string
      orderIndex: string
      anchor: string
      windowStartDays: string
      windowEndDays: string
      cadenceKind: string
      cadenceEveryDays: string
      cadenceIntervals: string
      maxSendsInStage: string
      respectQuietHours: string
    }
    placeholders: {
      name: string
    }
    anchors: {
      due_date: string
      booking_created_at: string
      departure_date: string
      invoice_issued_at: string
      last_send_at: string
    }
    cadences: {
      once: string
      every_n_days: string
      escalating: string
    }
    intervalRow: {
      whenDaysUntilDueGT: string
      whenDaysUntilDueLT: string
      repeatEveryDays: string
      addInterval: string
      removeInterval: string
    }
    titles: {
      create: string
      edit: string
    }
  }
  channel: {
    listHeading: string
    listEmpty: string
    addChannel: string
    deleteConfirm: string
    fields: {
      orderIndex: string
      channel: string
      provider: string
      template: string
      recipientKind: string
    }
    channels: {
      email: string
      sms: string
    }
    recipientKinds: {
      primary: string
      cc: string
      bcc: string
    }
    providers: {
      automatic: string
      resend: string
      twilio: string
    }
    titles: {
      create: string
      edit: string
    }
    placeholders: {
      template: string
    }
  }
  settings: {
    heading: string
    description: string
    sections: {
      quietHours: string
      quietHoursDesc: string
      blackouts: string
      blackoutsDesc: string
      rateLimits: string
      rateLimitsDesc: string
    }
    fields: {
      quietHoursStart: string
      quietHoursEnd: string
      quietHoursTz: string
      blackoutDates: string
      skipWeekends: string
      skipWeekendsDesc: string
      recipientRateLimitPerDay: string
      suppressionWindowHours: string
    }
    placeholders: {
      tz: string
      noBlackouts: string
    }
    helpers: {
      blackoutDates: string
      recipientRateLimitPerDay: string
      suppressionWindowHours: string
    }
    actions: {
      addBlackoutDate: string
      removeBlackoutDate: string
    }
  }
  preview: {
    dateLabel: string
    empty: string
    columns: {
      rule: string
      stage: string
      target: string
      anchor: string
      scheduledAt: string
      reasoning: string
    }
  }
}

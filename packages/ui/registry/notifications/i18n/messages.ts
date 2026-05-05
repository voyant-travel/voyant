export type RegistryNotificationsMessages = {
  common: {
    channelLabels: {
      email: string
      sms: string
    }
    providerLabels: {
      automatic: string
      resend: string
      twilio: string
    }
    templateStatusLabels: {
      draft: string
      active: string
      archived: string
    }
    deliveryStatusLabels: {
      pending: string
      sent: string
      failed: string
      cancelled: string
    }
    reminderRunStatusLabels: {
      queued: string
      processing: string
      sent: string
      skipped: string
      failed: string
    }
    targetTypeLabels: {
      booking_confirmed: string
      booking_payment_schedule: string
      payment_complete: string
      booking_cancelled_non_payment: string
      invoice: string
    }
    cancel: string
    saveChanges: string
  }
  authoringHelp: {
    title: string
    description: string
    tabs: {
      variables: string
      liquid: string
    }
    searchPlaceholder: string
    noVariables: string
    example: string
    insert: string
    liquidUsage: string
    noLiquidSnippets: string
  }
  templatesPage: {
    title: string
    description: string
    add: string
    searchPlaceholder: string
    filters: {
      channel: string
      channelAll: string
      status: string
      statusAll: string
    }
    empty: string
    columns: {
      template: string
      channel: string
      provider: string
      status: string
      updated: string
      actions: string
    }
  }
  templateDialog: {
    titleNew: string
    titleEdit: string
    fields: {
      name: string
      slug: string
      channel: string
      provider: string
      status: string
      attachments: string
      attachmentContract: string
      attachmentInvoice: string
      attachmentBrochure: string
      fromAddress: string
      subject: string
      htmlBody: string
      textBodySms: string
      textFallback: string
      activateAfterSaving: string
    }
    placeholders: {
      name: string
      slug: string
      fromAddress: string
      subject: string
      htmlBody: string
      textBodySms: string
      textFallback: string
    }
    errors: {
      nameRequired: string
      slugRequired: string
      kebabCase: string
    }
    actions: {
      create: string
    }
  }
  reminderRulesPage: {
    title: string
    description: string
    add: string
    searchPlaceholder: string
    filters: {
      target: string
      targetAll: string
      channel: string
      channelAll: string
      status: string
      statusAll: string
    }
    empty: string
    daysSuffix: string
    timingEvent: string
    timingDueDate: string
    timingBeforeSuffix: string
    timingAfterSuffix: string
    columns: {
      rule: string
      target: string
      channel: string
      provider: string
      offset: string
      status: string
      actions: string
    }
  }
  reminderRuleDialog: {
    titleNew: string
    titleEdit: string
    fields: {
      name: string
      target: string
      status: string
      channel: string
      provider: string
      sendTiming: string
      template: string
    }
    placeholders: {
      name: string
      template: string
    }
    errors: {
      nameRequired: string
      templateRequired: string
    }
    timingHelp: string
    actions: {
      create: string
    }
  }
  deliveriesPage: {
    title: string
    description: string
    filters: {
      channel: string
      channelAll: string
      status: string
      statusAll: string
    }
    empty: string
    direct: string
    columns: {
      to: string
      template: string
      channel: string
      provider: string
      status: string
      created: string
    }
  }
  reminderRunsPage: {
    title: string
    description: string
    filters: {
      status: string
      statusAll: string
    }
    empty: string
    columns: {
      rule: string
      target: string
      recipient: string
      status: string
      processed: string
    }
  }
}

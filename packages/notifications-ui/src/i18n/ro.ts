import type { NotificationsUiMessages } from "./messages.js"

export const notificationsUiRo: NotificationsUiMessages = {
  common: {
    cancel: "Anulează",
    save: "Salvează",
    create: "Creează",
    edit: "Editează",
    delete: "Șterge",
    add: "Adaugă",
    none: "—",
    loading: "Se încarcă…",
    optionalPlaceholder: "Opțional",
  },
  stage: {
    listHeading: "Etape",
    listEmpty: "Nicio etapă încă. Adaugă una pentru a defini când se trimite regula.",
    addStage: "Adaugă etapă",
    deleteConfirm: "Ștergi această etapă?",
    fields: {
      name: "Nume",
      orderIndex: "Ordine",
      anchor: "Reper",
      windowStartDays: "Început fereastră (zile)",
      windowEndDays: "Sfârșit fereastră (zile)",
      cadenceKind: "Cadență",
      cadenceEveryDays: "La fiecare N zile",
      cadenceIntervals: "Praguri de escaladare",
      maxSendsInStage: "Trimiteri maxime per etapă",
      respectQuietHours: "Respectă orele de liniște",
    },
    placeholders: {
      name: "Prima reamintire",
    },
    anchors: {
      due_date: "Data scadenței",
      booking_created_at: "Data creării rezervării",
      departure_date: "Data plecării",
      invoice_issued_at: "Data emiterii facturii",
      last_send_at: "Ultima trimitere",
    },
    cadences: {
      once: "O singură dată",
      every_n_days: "La fiecare N zile",
      escalating: "Praguri de escaladare",
    },
    intervalRow: {
      whenDaysUntilDueGT: "Când zile-până-la-scadență >",
      whenDaysUntilDueLT: "Când zile-până-la-scadență <",
      repeatEveryDays: "Repetă la fiecare (zile)",
      addInterval: "Adaugă prag",
      removeInterval: "Șterge",
    },
    titles: {
      create: "Adaugă etapă",
      edit: "Editează etapă",
    },
  },
  channel: {
    listHeading: "Canale",
    listEmpty: "Niciun canal. Adaugă cel puțin unul pentru a livra această etapă.",
    addChannel: "Adaugă canal",
    deleteConfirm: "Ștergi acest canal?",
    fields: {
      orderIndex: "Ordine",
      channel: "Canal",
      provider: "Furnizor",
      template: "Șablon",
      recipientKind: "Destinatar",
    },
    channels: {
      email: "Email",
      sms: "SMS",
    },
    recipientKinds: {
      primary: "Principal",
      cc: "CC",
      bcc: "BCC",
    },
    providers: {
      automatic: "Automat",
      resend: "Resend (email)",
      twilio: "Twilio (SMS)",
    },
    titles: {
      create: "Adaugă canal",
      edit: "Editează canal",
    },
    placeholders: {
      template: "Caută șabloane…",
    },
  },
  settings: {
    heading: "Setări notificări",
    description: "Valori implicite pentru orele de liniște, blocaje și limite per destinatar.",
    sections: {
      quietHours: "Ore de liniște",
      quietHoursDesc: "Când se pot trimite reamintiri, în fusul orar al destinatarului.",
      blackouts: "Date blocate",
      blackoutsDesc: "Date specifice care se ignoră complet (sărbători, închideri).",
      rateLimits: "Limite și deduplicare",
      rateLimitsDesc: "Plafoane care se aplică tuturor regulilor pentru a proteja destinatarii.",
    },
    fields: {
      quietHoursStart: "Început",
      quietHoursEnd: "Sfârșit",
      quietHoursTz: "Fus orar",
      blackoutDates: "Date blocate",
      skipWeekends: "Sari peste weekend-uri",
      skipWeekendsDesc: "Amână reamintirile care ar cădea sâmbăta sau duminica.",
      recipientRateLimitPerDay: "Plafon zilnic per destinatar",
      suppressionWindowHours: "Fereastră de supresie (ore)",
    },
    placeholders: {
      tz: "Caută fusuri orare…",
      noBlackouts: "Nicio dată blocată.",
    },
    helpers: {
      blackoutDates: "Adaugă o dată pentru fiecare zi calendaristică de ignorat.",
      recipientRateLimitPerDay:
        "Numărul maxim de reamintiri trimise per destinatar/canal în 24h. Lasă gol pentru fără limită.",
      suppressionWindowHours:
        "Fereastră pentru deduplicarea regulilor care partajează același grup de supresie.",
    },
    actions: {
      addBlackoutDate: "Adaugă dată",
      removeBlackoutDate: "Șterge",
    },
  },
  preview: {
    heading: "Previzualizare reamintiri",
    description:
      "Doar pentru consultare — arată ce combinații (regulă, etapă, țintă) s-ar declanșa la data aleasă.",
    dateLabel: "Dată",
    refresh: "Reîmprospătează",
    empty: "Nimic nu s-ar declanșa la această dată.",
    columns: {
      rule: "Regulă",
      stage: "Etapă",
      target: "Țintă",
      anchor: "Reper",
      scheduledAt: "Programat la",
      reasoning: "Motiv",
    },
  },
}

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
      templateId: "Șablon",
      templateSlug: "Slug șablon",
      recipientKind: "Tip destinatar",
      recipientRole: "Rol destinatar",
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
    titles: {
      create: "Adaugă canal",
      edit: "Editează canal",
    },
  },
  settings: {
    heading: "Setări notificări",
    description: "Valori implicite pentru orele de liniște, blocaje și limite per destinatar.",
    fields: {
      quietHoursStart: "Început ore liniște (HH:MM)",
      quietHoursEnd: "Sfârșit ore liniște (HH:MM)",
      quietHoursTz: "Fus orar",
      blackoutDates: "Date blocate",
      skipWeekends: "Sari peste weekend-uri",
      holidayCalendar: "Calendar sărbători (locale)",
      recipientRateLimitPerDay: "Plafon zilnic per destinatar",
      suppressionWindowHours: "Fereastră de supresie (ore)",
    },
    helpers: {
      blackoutDates: "Date ISO (YYYY-MM-DD), una pe linie.",
      recipientRateLimitPerDay:
        "Numărul maxim de reamintiri trimise per destinatar/canal în 24h. Lasă gol pentru fără limită.",
      suppressionWindowHours:
        "Fereastră pentru deduplicarea regulilor care partajează același grup de supresie.",
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

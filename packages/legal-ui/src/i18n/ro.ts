import type { LegalUiMessages } from "./messages.js"

export const legalUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
    create: "Creeaza",
    edit: "Editeaza",
    add: "Adauga",
    loading: "Se incarca...",
    none: "-",
    selectPlaceholder: "Selecteaza...",
    optionalPlaceholder: "Optional",
    kilobytes: "KB",
  },
  bookingContractCard: {
    heading: "Contract",
    empty: "Nu a fost generat inca niciun contract pentru aceasta rezervare.",
    generate: "Genereaza",
    regenerate: "Regenereaza",
    download: "Descarca",
    noAttachments: "Nu exista inca documente atasate.",
    issuedAt: "Emis",
    contractNumber: "#",
    unsaved: "In asteptare",
    contractStatusLabels: {
      draft: "Ciorna",
      issued: "Emis",
      sent: "Trimis",
      signed: "Semnat",
      executed: "Executat",
      expired: "Expirat",
      void: "Anulat",
    },
  },
  numberSeriesPage: {
    title: "Serii numere contracte",
    description: "Configureaza secventele de numerotare pentru contracte.",
    actions: {
      create: "Serie noua",
    },
    columns: {
      name: "Nume",
      prefix: "Prefix",
      separator: "Separator",
      pad: "Completare",
      current: "Curent",
      reset: "Resetare",
      scope: "Domeniu",
      status: "Status",
    },
    active: "Activ",
    inactive: "Inactiv",
    empty: "Nu exista serii de numere. Creeaza una pentru numerotarea contractelor.",
    deleteConfirm: 'Stergi seria "{name}"?',
  },
  attachmentDialog: {
    titles: {
      create: "Adauga atasament",
      edit: "Editeaza atasamentul",
    },
    fields: {
      name: "Nume",
      kind: "Tip",
      mimeType: "Tip MIME",
      fileSize: "Dimensiune fisier",
      checksum: "Checksum",
      storageKey: "Cheie stocare",
    },
    placeholders: {
      name: "Numele atasamentului",
      kind: "appendix",
      mimeType: "application/pdf",
      fileSize: "Octeti",
      checksum: "Optional",
      storageKey: "Referinta optionala de stocare",
    },
    actions: {
      create: "Adauga atasament",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
    },
  },
  policyRuleDialog: {
    titles: {
      create: "Regula noua",
      edit: "Editeaza regula",
    },
    fields: {
      ruleType: "Tip regula",
      sortOrder: "Ordine",
      label: "Eticheta",
      daysBeforeDeparture: "Zile inainte de plecare",
      refundPercent: "Procent rambursare (puncte de baza)",
      refundType: "Tip rambursare",
      currency: "Moneda",
      flatAmountCents: "Suma fixa (centi)",
    },
    placeholders: {
      label: "ex. 30+ zile inainte de plecare",
      daysBeforeDeparture: "ex. 30",
      refundPercent: "ex. 10000 = 100%",
      flatAmountCents: "ex. 5000",
    },
    actions: {
      create: "Creeaza regula",
    },
    ruleTypeLabels: {
      window: "Fereastra",
      percentage: "Procent",
      flat_amount: "Suma fixa",
      date_range: "Interval de date",
      custom: "Personalizata",
    },
    refundTypeLabels: {
      cash: "Numerar",
      credit: "Credit",
      cash_or_credit: "Numerar sau credit",
      none: "Fara",
    },
    validation: {
      refundPercentMin: "Procentul de rambursare trebuie sa fie cel putin 0",
      refundPercentMax: "Procentul de rambursare trebuie sa fie cel mult 10000",
    },
  },
  signatureDialog: {
    title: "Inregistreaza semnatura",
    fields: {
      signerName: "Nume semnatar",
      signerEmail: "Email semnatar",
      signerRole: "Rol semnatar",
      method: "Metoda",
      provider: "Furnizor",
      externalReference: "Referinta externa",
    },
    placeholders: {
      signerName: "Nume complet",
      signerEmail: "email@example.com",
      signerRole: "ex. CEO, reprezentant legal",
      provider: "Optional",
      externalReference: "Optional",
    },
    actions: {
      submit: "Inregistreaza semnatura",
    },
    methodLabels: {
      manual: "Manual",
      electronic: "Electronic",
      docusign: "DocuSign",
      other: "Altul",
    },
    validation: {
      signerNameRequired: "Numele semnatarului este obligatoriu",
      signerEmailInvalid: "Introdu o adresa de email valida",
    },
  },
  policyVersionDialog: {
    titles: {
      create: "Versiune noua",
      edit: "Editeaza versiunea",
    },
    fields: {
      title: "Titlu",
      body: "Continut",
    },
    placeholders: {
      title: "Titlul versiunii",
      body: "Continutul politicii...",
    },
    actions: {
      create: "Creeaza versiunea",
    },
    validation: {
      titleRequired: "Titlul este obligatoriu",
    },
  },
} satisfies LegalUiMessages

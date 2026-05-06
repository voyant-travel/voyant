import type { IdentityUiMessages } from "./messages.js"

export const identityUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza Modificarile",
    primary: "Principal",
    addressLabelLabels: {
      primary: "Principal",
      billing: "Facturare",
      shipping: "Livrare",
      mailing: "Corespondenta",
      meeting: "Intalnire",
      service: "Serviciu",
      legal: "Juridic",
      other: "Altul",
    },
    contactPointKindLabels: {
      email: "Email",
      phone: "Telefon",
      mobile: "Mobil",
      whatsapp: "WhatsApp",
      website: "Website",
      sms: "SMS",
      fax: "Fax",
      social: "Social",
      other: "Altul",
    },
    namedContactRoleLabels: {
      general: "General",
      primary: "Principal",
      reservations: "Rezervari",
      operations: "Operatiuni",
      front_desk: "Receptie",
      sales: "Vanzari",
      emergency: "Urgenta",
      accounting: "Contabilitate",
      legal: "Juridic",
      other: "Altul",
    },
  },
  addressDialog: {
    titles: {
      create: "Adauga Adresa",
      edit: "Editeaza Adresa",
    },
    fields: {
      label: "Eticheta",
      line1: "Linia 1",
      line2: "Linia 2",
      city: "Oras",
      region: "Regiune",
      postalCode: "Cod postal",
      country: "Tara",
      timezone: "Fus orar",
      latitude: "Latitudine",
      longitude: "Longitudine",
      notes: "Note",
    },
    placeholders: {
      timezone: "Europe/Istanbul",
    },
    actions: {
      create: "Adauga Adresa",
    },
  },
  contactPointDialog: {
    titles: {
      create: "Adauga Punct de Contact",
      edit: "Editeaza Punctul de Contact",
    },
    fields: {
      kind: "Tip",
      label: "Eticheta",
      value: "Valoare",
      notes: "Note",
    },
    placeholders: {
      label: "serviciu, personal...",
      value: "nume@example.com",
    },
    actions: {
      create: "Adauga Punct de Contact",
    },
    validation: {
      valueRequired: "Valoarea este obligatorie",
    },
  },
  namedContactDialog: {
    titles: {
      create: "Adauga Contact Nominal",
      edit: "Editeaza Contactul Nominal",
    },
    fields: {
      role: "Rol",
      name: "Nume",
      title: "Titlu",
      email: "Email",
      phone: "Telefon",
      notes: "Note",
    },
    placeholders: {
      name: "Jane Doe",
      title: "Director de Vanzari",
      email: "jane@example.com",
    },
    actions: {
      create: "Adauga Contact Nominal",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
    },
  },
} satisfies IdentityUiMessages

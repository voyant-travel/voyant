import type { IdentityUiMessages } from "./messages.js"

export const identityUiRo = {
  common: {
    cancel: "Anuleaza",
    saveChanges: "Salveaza modificarile",
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
  identityPage: {
    title: "Identitate",
    description:
      "Gestioneaza numerele de telefon, adresele si contactele pentru orice inregistrare.",
    fields: {
      entityType: "Tip inregistrare",
      entity: "Inregistrare",
      customEntityType: "Alt tip de inregistrare",
    },
    placeholders: {
      entityType: "person, organization, supplier...",
      entity: "Insereaza o referinta pentru tipuri de inregistrare personalizate",
    },
    entityTypeLabels: {
      person: "Persoana",
      organization: "Organizatie",
      supplier: "Furnizor",
      booking: "Rezervare",
      product: "Produs",
    },
    emptyScope: "Alege o inregistrare mai sus pentru a vedea contactele si adresele sale.",
    tabs: {
      contactPoints: "Detalii de contact",
      addresses: "Adrese",
      namedContacts: "Contacte nominale",
    },
  },
  contactPointsTab: {
    description:
      "Numere de telefon, emailuri si alte canale de comunicare pentru aceasta inregistrare.",
    add: "Adauga detaliu de contact",
    empty: {
      loading: "Se incarca punctele de contact...",
      none: "Nu exista puncte de contact inca.",
    },
    columns: {
      kind: "Tip",
      value: "Valoare",
      label: "Eticheta",
      primary: "Primar",
    },
    actions: {
      deleteConfirm: "Stergi punctul de contact?",
    },
  },
  addressesTab: {
    description: "Adrese fizice si postale asociate acestei inregistrari.",
    add: "Adauga adresa",
    empty: {
      loading: "Se incarca adresele...",
      none: "Nu exista adrese inca.",
    },
    columns: {
      label: "Eticheta",
      street: "Strada",
      city: "Oras",
      country: "Tara",
      primary: "Primara",
    },
    actions: {
      deleteConfirm: "Stergi adresa?",
    },
  },
  namedContactsTab: {
    description: "Persoane nominale asociate acestei inregistrari.",
    add: "Adauga contact nominal",
    empty: {
      loading: "Se incarca contactele nominale...",
      none: "Nu exista contacte nominale inca.",
    },
    columns: {
      role: "Rol",
      name: "Nume",
      title: "Titlu",
      email: "Email",
      phone: "Telefon",
      primary: "Primar",
    },
    actions: {
      deleteConfirm: "Stergi contactul nominal?",
    },
  },
  addressDialog: {
    titles: {
      create: "Adauga adresa",
      edit: "Editeaza adresa",
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
      create: "Adauga adresa",
    },
  },
  contactPointDialog: {
    titles: {
      create: "Adauga detaliu de contact",
      edit: "Editeaza detaliul de contact",
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
      create: "Adauga detaliu de contact",
    },
    validation: {
      valueRequired: "Valoarea este obligatorie",
    },
  },
  namedContactDialog: {
    titles: {
      create: "Adauga contact nominal",
      edit: "Editeaza contactul nominal",
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
      create: "Adauga contact nominal",
    },
    validation: {
      nameRequired: "Numele este obligatoriu",
    },
  },
} satisfies IdentityUiMessages

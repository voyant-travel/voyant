import type { RegistryIdentityMessages } from "./messages"

export const registryIdentityRo = {
  page: {
    title: "Identitate",
    description:
      "Gestioneaza punctele de contact, adresele si contactele nominale atasate oricarei entitati.",
    fields: {
      entityType: "Tip entitate",
      entity: "Entitate",
      customEntityType: "Alt tip de entitate",
    },
    placeholders: {
      entityType: "person, organization, supplier...",
      entity: "Insereaza o referinta pentru tipuri custom",
    },
    entityTypeLabels: {
      person: "Persoana",
      organization: "Organizatie",
      supplier: "Furnizor",
      booking: "Rezervare",
      product: "Produs",
    },
    emptyScope: "Alege o entitate mai sus pentru a vedea inregistrarile de identitate.",
    tabs: {
      contactPoints: "Puncte de contact",
      addresses: "Adrese",
      namedContacts: "Contacte nominale",
    },
  },
  contactPointsTab: {
    description:
      "Numere de telefon, emailuri si alte canale de comunicare pentru aceasta entitate.",
    add: "Adauga punct de contact",
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
    description: "Adrese fizice si postale asociate acestei entitati.",
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
    description: "Persoane nominale asociate acestei entitati.",
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
} satisfies RegistryIdentityMessages

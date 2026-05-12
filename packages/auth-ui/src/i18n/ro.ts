import type { AuthUiMessages } from "./messages.js"

export const authUiRo: AuthUiMessages = {
  serviceApiKeysPage: {
    title: "Tokenuri API",
    description:
      "Creeaza tokenuri API cu permisiuni pentru automatizari, integrari si sisteme terte.",
    createdToken: {
      title: "Token nou",
      description: "Acest token este afisat o singura data. Salveaza-l inainte sa pleci.",
      copy: "Copiaza",
    },
    create: {
      title: "Creeaza token",
      name: "Nume",
      namePlaceholder: "Sincronizare CMS, webhook relay, automatizare nocturna",
      expiration: "Expirare",
      submit: "Creeaza token",
      errors: {
        nameRequired: "Numele tokenului este obligatoriu.",
        permissionRequired: "Selecteaza cel putin o permisiune.",
        createFailed: "Tokenul API nu a putut fi creat.",
      },
      expirationOptions: {
        never: "Fara expirare",
        sevenDays: "7 zile",
        thirtyDays: "30 de zile",
        ninetyDays: "90 de zile",
        oneYear: "1 an",
      },
    },
    list: {
      title: "Tokenuri existente",
      refresh: "Reincarca",
      loading: "Se incarca tokenurile",
      empty: "Nu a fost creat inca niciun token API.",
      untitled: "Token fara nume",
      enabled: "Activ",
      disabled: "Inactiv",
      noPermissions: "Fara permisiuni",
      metadata: "Creat {created} · Expira {expires} · Ultima utilizare {lastUsed}",
      disable: "Dezactiveaza",
      enable: "Activeaza",
      delete: "Sterge",
    },
    permissions: {
      fullAccess: "Acces complet",
    },
    date: {
      never: "Niciodata",
    },
  },
}

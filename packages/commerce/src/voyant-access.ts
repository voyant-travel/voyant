export const commerceAccess = {
  resources: [
    {
      id: "@voyant-travel/commerce#access.pricing",
      resource: "pricing",
      label: "Pricing",
      description: "Read and manage commercial pricing rules.",
      actions: [
        {
          action: "read",
          label: "Read pricing",
          description: "Read pricing rules and calculated price state.",
        },
        {
          action: "write",
          label: "Manage pricing",
          description: "Create and update commercial pricing rules.",
          sensitive: true,
        },
      ],
    },
    {
      id: "@voyant-travel/commerce#access.markets",
      resource: "markets",
      label: "Markets",
      description: "Read and manage sales markets, locales, currencies, and channels.",
      actions: [
        {
          action: "read",
          label: "Read markets",
          description: "Read market and locale configuration.",
        },
        {
          action: "write",
          label: "Manage markets",
          description: "Create and update market and locale configuration.",
          sensitive: true,
        },
        {
          action: "delete",
          label: "Delete markets",
          description: "Delete market-owned configuration records.",
          sensitive: true,
        },
      ],
    },
    {
      id: "@voyant-travel/commerce#access.sellability",
      resource: "sellability",
      label: "Sellability",
      description: "Read and manage product sellability policies and restrictions.",
      actions: [
        {
          action: "read",
          label: "Read sellability",
          description: "Read sellability policies and evaluated restrictions.",
        },
        {
          action: "write",
          label: "Manage sellability",
          description: "Create and update sellability policies and restrictions.",
          sensitive: true,
        },
        {
          action: "delete",
          label: "Delete sellability rules",
          description: "Delete sellability policies and restrictions.",
          sensitive: true,
        },
      ],
    },
    {
      id: "@voyant-travel/commerce#access.promotions",
      resource: "promotions",
      label: "Promotions",
      description: "Read and manage commercial promotions and redemption policy.",
      actions: [
        {
          action: "read",
          label: "Read promotions",
          description: "Read promotions and their redemption policy.",
        },
        {
          action: "write",
          label: "Manage promotions",
          description: "Create, update, activate, or deactivate promotions.",
          sensitive: true,
        },
        {
          action: "delete",
          label: "Delete promotions",
          description: "Delete promotion records.",
          sensitive: true,
        },
      ],
    },
  ],
} as const

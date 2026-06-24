import type { AdminDestinationResolvers } from "@voyant-travel/admin"
import type {} from "@voyant-travel/relationships-react/admin"

type DestinationResolver = (params: never) => string

const relationshipDestinations: Record<string, DestinationResolver> = {
  "person.list": () => "/people",
  "person.detail": ({ personId }: { personId: string }) =>
    `/people/${encodeURIComponent(personId)}`,
  "organization.list": () => "/organizations",
  "organization.detail": ({ organizationId }: { organizationId: string }) =>
    `/organizations/${encodeURIComponent(organizationId)}`,
}

const fallbackResolvers = new Map<string, DestinationResolver>()

function getFallbackDestinationResolver(destination: string): DestinationResolver {
  const existing = fallbackResolvers.get(destination)
  if (existing) return existing

  const resolver = () => {
    console.warn(
      `[federated-operator] Admin destination "${destination}" is not mounted in this starter.`,
    )
    return "#"
  }
  fallbackResolvers.set(destination, resolver)
  return resolver
}

export const federatedAdminDestinations: AdminDestinationResolvers = new Proxy(
  Object.create(null) as AdminDestinationResolvers,
  {
    get(_target, property) {
      if (typeof property !== "string") {
        return undefined
      }

      return relationshipDestinations[property] ?? getFallbackDestinationResolver(property)
    },
  },
)

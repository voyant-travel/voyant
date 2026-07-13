# @voyant-travel/operator-standard

Versioned standard Voyant Operator product distribution. It owns the standard
package BOM together with the product frontend composition, generated route
catalog, and product styles.

Consumer projects select this distribution once. The generated deployment
graph remains inspectable, while the project does not repeat first-party
packages, routes, or frontend wiring.

## Exports

| Entry | Description |
| --- | --- |
| `.` | Standard product distribution and selection policy |
| `./standard-frontend` | Standard auth, providers, public routes, workspace, and router composition |
| `./standard-route-files` | Generated TanStack route hosts for the standard product |
| `./standard-styles.css` | Tailwind sources and standard product package styles |

## License

Apache-2.0

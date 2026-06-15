export const localTenantMeta = {
  tenantId: "tnt_local",
  projectId: "prj_local",
  organizationId: "org_local",
}

export function createDefaultWakeupLeaseOwner(): string {
  return `selfhost-${process.pid}-${Math.random().toString(36).slice(2, 8)}`
}

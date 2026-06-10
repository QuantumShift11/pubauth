import type { AdminUiNavItem } from './page-contracts.js';

export const adminUiNavigation: AdminUiNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/dashboard', description: 'Runtime and control-plane overview' },
  { id: 'products', label: 'Products', path: '/products', description: 'Product registry and ownership' },
  { id: 'workspaces', label: 'Workspaces', path: '/workspaces', description: 'Tenant workspace administration' },
  { id: 'oidc-clients', label: 'OIDC Clients', path: '/oidc-clients', description: 'Client registrations and redirects' },
  { id: 'gateway-policies', label: 'Gateway Policies', path: '/gateway-policies', description: 'Route and upstream controls' },
  { id: 'roles-assignments', label: 'Roles & Assignments', path: '/roles-assignments', description: 'Scoped access management' },
  { id: 'audit-logs', label: 'Audit Logs', path: '/audit-logs', description: 'Operational history and forensics' },
  { id: 'provider-setup', label: 'Provider Setup', path: '/provider-setup', description: 'Google and Entra broker configuration' },
];

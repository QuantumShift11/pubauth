export type AdminUiPageId =
  | 'dashboard'
  | 'products'
  | 'workspaces'
  | 'oidc-clients'
  | 'gateway-policies'
  | 'roles-assignments'
  | 'audit-logs'
  | 'provider-setup';

export interface AdminUiNavItem {
  id: AdminUiPageId;
  label: string;
  path: string;
  description: string;
}

export interface AdminUiPageDefinition {
  id: AdminUiPageId;
  title: string;
  summary: string;
  path: string;
  widgets: string[];
  apiDependencies: string[];
}

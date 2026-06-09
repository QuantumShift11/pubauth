export interface GatewayPrincipal {
  userId: string;
  workspaceId: string;
  roles: string[];
  groups: string[];
}

export function buildForwardHeaders(principal: GatewayPrincipal): Record<string, string> {
  return {
    'x-pubauth-user-id': principal.userId,
    'x-pubauth-workspace-id': principal.workspaceId,
    'x-pubauth-roles': principal.roles.join(','),
    'x-pubauth-groups': principal.groups.join(','),
  };
}

export function removePubAuthHeaders(headers: Record<string, string | string[] | undefined>) {
  const cleanHeaders: Record<string, string | string[] | undefined> = { ...headers };

  for (const name of Object.keys(cleanHeaders)) {
    if (name.toLowerCase().startsWith('x-pubauth-')) {
      delete cleanHeaders[name];
    }
  }

  return cleanHeaders;
}

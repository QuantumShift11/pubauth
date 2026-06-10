export interface AdminUiApiClient {
  getBootstrap(): Promise<unknown>;
  getOverview(): Promise<unknown>;
  createProduct(payload: Record<string, unknown>): Promise<unknown>;
  createWorkspace(payload: Record<string, unknown>): Promise<unknown>;
  createClient(payload: Record<string, unknown>): Promise<unknown>;
  createRoutePolicy(payload: Record<string, unknown>): Promise<unknown>;
  createRole(payload: Record<string, unknown>): Promise<unknown>;
  assignRole(payload: Record<string, unknown>): Promise<unknown>;
}

export function createAdminUiApiClient(baseUrl: string): AdminUiApiClient {
  async function request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
      ...init,
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      throw new Error(`admin_ui_request_failed:${response.status}`);
    }
    return payload;
  }

  return {
    getBootstrap: () => request('/api/bootstrap'),
    getOverview: () => request('/api/admin/overview'),
    createProduct: (payload) => request('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
    createWorkspace: (payload) => request('/api/admin/workspaces', { method: 'POST', body: JSON.stringify(payload) }),
    createClient: (payload) => request('/api/admin/clients', { method: 'POST', body: JSON.stringify(payload) }),
    createRoutePolicy: (payload) => request('/api/admin/route-policies', { method: 'POST', body: JSON.stringify(payload) }),
    createRole: (payload) => request('/api/admin/roles', { method: 'POST', body: JSON.stringify(payload) }),
    assignRole: (payload) => request('/api/admin/assignments', { method: 'POST', body: JSON.stringify(payload) }),
  };
}

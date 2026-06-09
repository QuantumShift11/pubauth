export interface TenantWorkspace {
  id: string;
  slug: string;
  name: string;
  state: 'active' | 'disabled';
}

export interface TenantStore {
  getById(id: string): Promise<TenantWorkspace | null>;
  getBySlug(slug: string): Promise<TenantWorkspace | null>;
}

export type UserId = string;
export type WorkspaceId = string;
export type ProductId = string;
export type ClientId = string;
export type RoleName = string;
export type GroupName = string;

export interface Principal {
  userId: UserId;
  workspaceId: WorkspaceId;
  roles: RoleName[];
  groups: GroupName[];
}

export interface ProductContext {
  productId: ProductId;
  workspaceId: WorkspaceId;
  environment: 'local' | 'dev' | 'qa' | 'prod';
}

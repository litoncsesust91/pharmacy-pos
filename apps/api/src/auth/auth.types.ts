export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  branchIds: string[];
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
}

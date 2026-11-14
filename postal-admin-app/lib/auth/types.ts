export type TUserRole = 'ADMIN' | 'STAFF' | 'VENDOR' | 'RIDER' | 'CUSTOMER' | string;

export interface IAuthUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: TUserRole | null;
  userType?: string | null;
  isActive?: boolean | null;
  image?: string | null;
  currentWalletAmount?: number | null;
}

export interface ILoginPayload {
  userId?: string | null;
  token: string;
  refreshToken?: string | null;
  tokenExpiration?: number | null;
  isActive?: boolean | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  userType?: string | null;
  image?: string | null;
  user?: IAuthUser | null;
}

export const ALLOWED_ROLES: readonly string[] = ['ADMIN', 'STAFF'];

export const isAllowedRole = (role?: string | null): boolean =>
  Boolean(role && ALLOWED_ROLES.includes(role.toUpperCase()));

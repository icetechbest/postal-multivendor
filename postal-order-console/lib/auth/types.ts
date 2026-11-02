export type TUserRole = 'ADMIN' | 'STAFF' | 'VENDOR' | 'RIDER' | 'USER' | 'RESTAURANT';

export interface IAuthUser {
  _id: string;
  name?: string | null;
  email?: string | null;
  role: TUserRole | string;
  image?: string | null;
}

export interface ISessionPayload {
  token: string;
  tokenExpiration: number;
  user: IAuthUser;
}

export const ALLOWED_ROLES: readonly string[] = ['ADMIN', 'STAFF'];

export const isAllowedRole = (role: string | undefined | null): boolean =>
  !!role && ALLOWED_ROLES.includes(role);

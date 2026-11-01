import { Types } from 'mongoose';
import { AuthContext, requireAuth, requireRole } from '../../middleware/auth';
import { AuditLog } from '../../models/AuditLog';
import { AuthorizationError, ValidationError } from '../../utils/errors';

/** Super admin only (configuration, staff, vendors, ...). */
export const requireSuperAdmin = (context: AuthContext): void => requireRole(context, ['ADMIN']);
/** Dashboard readers: super admin, staff and restaurant owners. */
export const requireDashboard = (context: AuthContext): void => requireRole(context, ['ADMIN', 'STAFF', 'VENDOR']);
/** Super admin or staff (platform-wide read access). */
export const requirePlatformReader = (context: AuthContext): void => requireRole(context, ['ADMIN', 'STAFF']);

export const isSuperAdmin = (context: AuthContext): boolean => context.user?.role === 'ADMIN';

/** The admin sends `_id: ''` when creating; treat blank ids as absent. */
export const cleanId = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text && text !== 'undefined' && text !== 'null' ? text : undefined;
};

export const assertObjectId = (value: unknown, label = 'id'): string => {
  const text = cleanId(value);
  if (!text || !Types.ObjectId.isValid(text)) throw new ValidationError(`Invalid ${label}`);
  return text;
};

export const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const pageParams = (page?: number | null, limit?: number | null, fallbackLimit = 10) => {
  const safeLimit = Math.min(Math.max(Math.floor(Number(limit) || fallbackLimit), 1), 500);
  const safePage = Math.max(Math.floor(Number(page) || 1), 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** Translates the admin's date keyword / explicit range into a Mongo date filter. */
export const dateRange = (keyword?: string | null, start?: string | null, end?: string | null): { $gte?: Date; $lte?: Date } | undefined => {
  const now = new Date();
  const key = (keyword || '').toLowerCase();
  if (key === 'today') return { $gte: startOfDay(now), $lte: now };
  if (key === 'week') return { $gte: new Date(now.getTime() - 7 * 86_400_000), $lte: now };
  if (key === 'month') return { $gte: new Date(now.getTime() - 30 * 86_400_000), $lte: now };
  const range: { $gte?: Date; $lte?: Date } = {};
  if (start) {
    const from = new Date(start);
    if (!Number.isNaN(from.getTime())) range.$gte = from;
  }
  if (end) {
    const to = new Date(end);
    if (!Number.isNaN(to.getTime())) {
      if (to.getHours() === 0 && to.getMinutes() === 0 && to.getSeconds() === 0) to.setHours(23, 59, 59, 999);
      range.$lte = to;
    }
  }
  return range.$gte || range.$lte ? range : undefined;
};

export const yearRange = (year: number) => ({ $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) });

export const round2 = (value: number): number => Math.round((Number(value) || 0) * 100) / 100;

/** Best-effort audit trail; never fails the calling mutation. Never pass secrets in `changes`. */
export const audit = async (context: AuthContext, action: string, targetType: string, targetId?: unknown, changes?: unknown): Promise<void> => {
  try {
    await AuditLog.create({
      admin: context.user?.userId,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      changes,
    });
  } catch {
    // auditing must not break the operation
  }
};

/** Drops undefined values so `$set` only touches fields the caller actually sent. */
export const definedOnly = <T extends Record<string, any>>(input: T | null | undefined): Partial<T> =>
  Object.fromEntries(Object.entries(input || {}).filter(([, value]) => value !== undefined)) as Partial<T>;

/** Restaurant owners (VENDOR) may only touch their own restaurants. */
export const ensureRestaurantOwner = (restaurant: { owner?: any }, context: AuthContext): void => {
  requireAuth(context);
  const role = context.user!.role;
  if (role === 'ADMIN' || role === 'STAFF') return;
  const ownerId = String(restaurant.owner?._id || restaurant.owner || '');
  if (role === 'VENDOR' && ownerId === context.user!.userId) return;
  throw new AuthorizationError();
};

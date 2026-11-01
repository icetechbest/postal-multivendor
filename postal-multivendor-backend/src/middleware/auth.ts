import { verifyToken } from '../utils/jwt';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { User } from '../models/User';

export interface AuthContext {
  user?: {
    userId: string;
    email: string;
    role: string;
  };
}

export const authenticate = async (token: string | undefined): Promise<AuthContext> => {
  if (!token) {
    return {};
  }

  try {
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.replace(/^Bearer\s+/i, '');
    const decoded = verifyToken(cleanToken);

    // Verify user still exists and is active
    const user = await User.findById(decoded.userId).select('+sessionResetAt');
    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }
    // resetUserSession invalidates every access token issued before the reset.
    if (user.sessionResetAt && decoded.iat && decoded.iat < Math.floor(user.sessionResetAt.getTime() / 1000)) {
      throw new AuthenticationError('Session was reset');
    }

    return {
      user: {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      },
    };
  } catch {
    // Public operations remain available with missing, expired, or malformed tokens.
    // Protected resolvers still enforce authentication through requireAuth().
    return {};
  }
};

export const requireAuth = (context: AuthContext): void => {
  if (!context.user) {
    throw new AuthenticationError('Authentication required');
  }
};

export const requireRole = (context: AuthContext, allowedRoles: string[]): void => {
  requireAuth(context);
  
  if (!context.user || !allowedRoles.includes(context.user.role)) {
    throw new AuthorizationError(`Requires one of the following roles: ${allowedRoles.join(', ')}`);
  }
};

export const requireAdmin = (context: AuthContext): void => {
  requireRole(context, ['ADMIN']);
};

export const requireVendor = (context: AuthContext): void => {
  requireRole(context, ['VENDOR', 'ADMIN']);
};

export const requireRider = (context: AuthContext): void => {
  requireRole(context, ['RIDER', 'ADMIN']);
};

/**
 * Helpers for returning mongoose documents to GraphQL without leaking secrets.
 *
 * IMPORTANT: never do `doc.password = undefined` on a mongoose document that may
 * be saved later. Assigning `undefined` marks the path as modified, so the next
 * `doc.save()` writes `$unset: { password: 1 }` and permanently deletes the
 * stored hash — which silently breaks every subsequent login.
 */

type AnyDoc = Record<string, any>;

const SENSITIVE_PATHS = [
  'password',
  'refreshTokenHash',
  'resetPasswordToken',
  'resetPasswordExpiry',
] as const;

/** Convert a document/lean object into a plain object with secrets removed. */
export const sanitizeUser = <T extends AnyDoc>(user: T): AnyDoc => {
  const plain: AnyDoc =
    typeof (user as AnyDoc).toObject === 'function' ? (user as AnyDoc).toObject() : { ...user };
  for (const path of SENSITIVE_PATHS) delete plain[path];
  return plain;
};

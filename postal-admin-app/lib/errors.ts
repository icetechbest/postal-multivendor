type TTranslate = (key: string) => string;

interface IErrorShape {
  message?: string;
  name?: string;
  networkError?: {
    name?: string;
    message?: string;
    statusCode?: number;
    response?: { status?: number };
    result?: { errors?: { message?: string }[] };
  } | null;
  graphQLErrors?: readonly { message?: string; extensions?: Record<string, unknown> }[];
}

export type TErrorKind =
  | 'unreachable'
  | 'timeout'
  | 'serverDown'
  | 'serverError'
  | 'session'
  | 'http'
  | 'server'
  | 'unknown';

/** Works out what kind of failure an Apollo/fetch/JS error is. */
export const classifyError = (
  input: unknown,
): { kind: TErrorKind; status?: number; detail: string } => {
  const error = (input ?? {}) as IErrorShape;
  const net = error.networkError;
  const status = net?.statusCode ?? net?.response?.status;
  const message = String(net?.message ?? error.message ?? '');
  const detail = net?.result?.errors?.[0]?.message ?? error.graphQLErrors?.[0]?.message ?? message;

  if (net || /network request failed|failed to fetch|aborted|timeout|timed out/i.test(message)) {
    if (net?.name === 'AbortError' || /abort|timeout|timed out/i.test(message)) {
      return { kind: 'timeout', status, detail };
    }
    if (status === 401 || status === 403) return { kind: 'session', status, detail };
    if (status === 502 || status === 503 || status === 504) return { kind: 'serverDown', status, detail };
    if (status && status >= 500) return { kind: 'serverError', status, detail };
    if (status) return { kind: 'http', status, detail };
    return { kind: 'unreachable', status, detail };
  }

  if (error.graphQLErrors?.length) {
    const unauthenticated = error.graphQLErrors.some((e) => e.extensions?.code === 'UNAUTHENTICATED');
    return { kind: unauthenticated ? 'session' : 'server', status, detail };
  }
  return { kind: 'unknown', status, detail };
};

/** Short, readable reason for an error, e.g. "The server is down or restarting (HTTP 503)". */
export const describeError = (error: unknown, t: TTranslate): string => {
  if (!error) return t('common.error');
  const { kind, status, detail } = classifyError(error);
  // For errors returned by the API itself, its own message is the most useful part.
  if (kind === 'server' && detail) return detail;
  const extra: string[] = [];
  if (status) extra.push(`HTTP ${status}`);
  if (kind === 'unknown' && detail) extra.push(detail);
  const base = t(`err.${kind}`);
  return extra.length ? `${base} (${extra.join(' - ')})` : base;
};

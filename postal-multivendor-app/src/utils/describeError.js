/**
 * Turns an Apollo / fetch / JS error into a short, human-readable reason.
 *
 * classifyError() -> { kind, status, detail }
 * describeError(error, t, { isConnected }) -> string ready to show to the user
 *
 * kinds: noInternet | serverUnreachable | timeout | serverDown (502/503/504) |
 *        serverError (500) | session (401/403) | http | server (GraphQL error) | unknown
 */
export const classifyError = (error, { isConnected } = {}) => {
  const net = error?.networkError
  const status = net?.statusCode || net?.response?.status || error?.status
  const message = String(net?.message || error?.message || '')
  const detail = net?.result?.errors?.[0]?.message || error?.graphQLErrors?.[0]?.message || message

  if (net || /network request failed|failed to fetch|aborted|timeout|timed out/i.test(message)) {
    if (net?.name === 'AbortError' || /abort|timeout|timed out/i.test(message)) {
      return { kind: 'timeout', status, detail }
    }
    if (status === 401 || status === 403) return { kind: 'session', status, detail }
    if (status === 502 || status === 503 || status === 504) return { kind: 'serverDown', status, detail }
    if (status >= 500) return { kind: 'serverError', status, detail }
    if (status) return { kind: 'http', status, detail }
    // No HTTP response at all: either the phone is offline, or the server is not answering.
    return { kind: isConnected === false ? 'noInternet' : 'serverUnreachable', status, detail }
  }

  if (error?.graphQLErrors?.length) {
    const unauthenticated = error.graphQLErrors.some((e) => e?.extensions?.code === 'UNAUTHENTICATED')
    return { kind: unauthenticated ? 'session' : 'server', status, detail }
  }
  return { kind: 'unknown', status, detail }
}

export const describeError = (error, t, options) => {
  const { kind, status, detail } = classifyError(error, options)
  const base = t(`err_${kind}`)
  // For server-side messages the backend's own text is the most useful part.
  if (kind === 'server' && detail) return detail
  const extra = []
  if (status) extra.push(`HTTP ${status}`)
  if (kind === 'unknown' && detail) extra.push(detail)
  return extra.length ? `${base} (${extra.join(' - ')})` : base
}

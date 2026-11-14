/** Formats an amount with up to 2 decimals and an optional currency symbol. */
export const formatMoney = (
  value: number | null | undefined,
  symbol?: string | null
): string => {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(safe);
  return symbol ? `${text} ${symbol}` : text;
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/** Round to 2 decimals so UI validation matches the backend's rounding. */
export const round2 = (n: number): number =>
  Math.round((Number(n) + Number.EPSILON) * 100) / 100;

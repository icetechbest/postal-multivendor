export const formatMoney = (value?: number | null, currency = 'SAR'): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return `0.00 ${currency}`;
  return `${value.toFixed(2)} ${currency}`;
};

export const formatNumber = (value?: number | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US').format(value);
};

export const formatDateTime = (value?: string | number | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatTime = (value?: string | number | null): string => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const statusTone = (
  status?: string | null,
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' => {
  switch ((status ?? '').toUpperCase()) {
    case 'COMPLETED':
    case 'DELIVERED':
      return 'success';
    case 'PENDING':
    case 'ACCEPTED':
    case 'ASSIGNED':
    case 'PICKED':
      return 'warning';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
};

export const isSameLocalDay = (value: string | number | undefined, reference = new Date()): boolean => {
  if (!value) return false;
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

export const initials = (name?: string | null): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

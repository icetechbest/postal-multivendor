const numberFromEnv = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const WARN_MINUTES = numberFromEnv(process.env.NEXT_PUBLIC_WARN_MINUTES, 5);
export const DANGER_MINUTES = numberFromEnv(process.env.NEXT_PUBLIC_DANGER_MINUTES, 10);
export const POLL_INTERVAL_MS = numberFromEnv(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS, 15000);
export const PAGE_SIZE = 10;
/** Lowest delivery price an admin may set when confirming an order (the backend enforces the same rule). */
export const MIN_DELIVERY_PRICE = numberFromEnv(process.env.NEXT_PUBLIC_MIN_DELIVERY_PRICE, 15);

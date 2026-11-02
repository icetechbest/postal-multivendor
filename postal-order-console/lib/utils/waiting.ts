import { DANGER_MINUTES, WARN_MINUTES } from '@/lib/config';

export type TWaitingLevel = 'normal' | 'warn' | 'danger';

export const waitingLevel = (minutes: number): TWaitingLevel => {
  if (minutes >= DANGER_MINUTES) return 'danger';
  if (minutes >= WARN_MINUTES) return 'warn';
  return 'normal';
};

export const waitingClasses: Record<TWaitingLevel, string> = {
  normal: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  warn: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 animate-pulse',
};

export const waitingBorderClasses: Record<TWaitingLevel, string> = {
  normal: 'border',
  warn: 'border-amber-400',
  danger: 'border-red-500',
};

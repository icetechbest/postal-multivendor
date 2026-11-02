export const LOCALES = ['ar', 'en'] as const;
export type TLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: TLocale = 'ar';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const isLocale = (value: string | undefined): value is TLocale =>
  !!value && (LOCALES as readonly string[]).includes(value);

export const isRtl = (locale: string): boolean => locale === 'ar';

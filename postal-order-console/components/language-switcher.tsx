'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { setUserLocale } from '@/lib/i18n/locale';
import { LOCALES, type TLocale } from '@/lib/i18n/config';

const LABELS: Record<TLocale, string> = { ar: 'العربية', en: 'English' };

export const LanguageSwitcher = () => {
  const locale = useLocale() as TLocale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const change = (next: TLocale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setUserLocale(next);
      router.refresh();
    });
  };

  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border text-xs"
      style={{ borderColor: 'var(--border)' }}
      role="group"
      aria-label="Language"
    >
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          disabled={isPending}
          onClick={() => change(item)}
          className={`px-2.5 py-1.5 transition ${
            item === locale ? 'bg-primary-color text-white' : 'bg-surface hover:bg-surface-muted'
          }`}
          aria-pressed={item === locale}
        >
          {LABELS[item]}
        </button>
      ))}
    </div>
  );
};

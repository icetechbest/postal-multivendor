'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';

export const AppHeader = () => {
  const t = useTranslations('common');
  const { user, logout } = useAuth();

  return (
    <header
      className="bg-surface/90 sticky top-0 z-30 border-b backdrop-blur"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-color text-lg text-white">
            ✓
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t('appName')}</p>
            {user ? (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {user.name || user.email} · {user.role}
              </p>
            ) : null}
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <button
            type="button"
            className="btn-ghost px-2.5 py-1.5 text-xs"
            onClick={() => void logout()}
          >
            {t('logout')}
          </button>
        </div>
      </div>
    </header>
  );
};

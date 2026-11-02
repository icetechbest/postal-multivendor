'use client';

import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';

export default function ForbiddenPage() {
  const t = useTranslations('login');
  const common = useTranslations('common');
  const { logout, user } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="card w-full max-w-md space-y-3 p-6 text-center" data-testid="forbidden">
        <p className="text-4xl">🔒</p>
        <h1 className="text-xl font-semibold">{t('forbiddenTitle')}</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {t('forbiddenBody')}
        </p>
        {user ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {user.email} · {user.role}
          </p>
        ) : null}
        <button type="button" className="btn-primary w-full" onClick={() => void logout()}>
          {common('logout')}
        </button>
      </div>
    </main>
  );
}

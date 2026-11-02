'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { LanguageSwitcher } from '@/components/language-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Spinner } from '@/components/ui/spinner';

export default function LoginPage() {
  const t = useTranslations('login');
  const common = useTranslations('common');
  const router = useRouter();
  const { status, login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/');
    if (status === 'forbidden') router.replace('/forbidden');
  }, [status, router]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.ok) {
      router.replace('/');
    } else {
      setError(result.message || t('invalid'));
    }
  };

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold">{common('appName')}</span>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6" data-testid="login-form">
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {t('subtitle')}
            </p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('email')}</span>
            <input
              type="email"
              className="input"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              data-testid="login-email"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('password')}</span>
            <input
              type="password"
              className="input"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              data-testid="login-password"
            />
          </label>

          {error ? (
            <p
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={submitting}
            data-testid="login-submit"
          >
            {submitting ? <Spinner /> : null}
            {submitting ? t('submitting') : t('submit')}
          </button>
        </form>
      </div>
    </main>
  );
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { AppHeader } from '@/components/app-header';
import { ToastProvider } from '@/components/ui/toast';
import { Spinner } from '@/components/ui/spinner';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useAuth();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'forbidden') router.replace('/forbidden');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <main className="grid min-h-screen place-items-center">
        <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Spinner className="h-5 w-5" />
          {t('loading')}
        </div>
      </main>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <AppHeader />
        {children}
      </div>
    </ToastProvider>
  );
}

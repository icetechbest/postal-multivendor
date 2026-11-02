import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { ApolloProvider } from '@/lib/apollo/apollo-provider';
import { AuthProvider } from '@/lib/auth/auth-context';
import { isRtl } from '@/lib/i18n/config';
import './globals.css';

export const metadata: Metadata = {
  title: 'Postal · Order Confirmation Console',
  description: 'Confirm or reject incoming orders in real time.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages({ locale });

  return (
    <html lang={locale} dir={isRtl(locale) ? 'rtl' : 'ltr'} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <NextIntlClientProvider messages={messages}>
            <ApolloProvider>
              <AuthProvider>{children}</AuthProvider>
            </ApolloProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

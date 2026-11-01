'use client';

import { GoogleMapsProvider } from '@/lib/context/global/google-maps.context';
// Layout
import GlobalLayout from '@/lib/ui/layouts/protected/global';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <GoogleMapsProvider>
      <GlobalLayout>{children}</GlobalLayout>
    </GoogleMapsProvider>
  );
}

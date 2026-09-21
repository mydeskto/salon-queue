import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { Toaster } from '@/components/ui/sonner';
import { RouteProgress } from '@/components/route-progress';

export const metadata: Metadata = {
  title: 'Salon Queue',
  description: 'Kiosk check-in, chair assignment, and reception billing for salons',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <AuthProvider>{children}</AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}

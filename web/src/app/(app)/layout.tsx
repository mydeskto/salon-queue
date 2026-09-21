"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import type { UserRole } from '@shared/index';
import { homeFor, useAuth } from '@/lib/auth';
import { NavLink } from '@/components/ui';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const NAV: Record<UserRole, Array<{ href: string; label: string }>> = {
  super_admin: [
    { href: '/super', label: 'Platform' },
    { href: '/super/salons', label: 'Salons' },
  ],
  salon_admin: [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/employees', label: 'Employees' },
    { href: '/admin/chairs', label: 'Chairs' },
    { href: '/admin/services', label: 'Services' },
    { href: '/admin/staff', label: 'Reception staff' },
    { href: '/admin/customers', label: 'Customers' },
    { href: '/admin/branding', label: 'Branding' },
    { href: '/reception', label: 'Live queue' },
  ],
  receptionist: [
    { href: '/reception', label: 'Live queue' },
    { href: '/reception/appointments', label: 'Appointments' },
    { href: '/reception/bills', label: 'Bills' },
  ],
  employee: [{ href: '/reception', label: 'Live queue' }],
  // Kiosk screens never see the staff app shell — they're redirected below.
  kiosk: [],
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U';
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'kiosk') {
      router.replace(homeFor(user));
    }
  }, [loading, user, router]);

  if (loading || !user || user.role === 'kiosk') {
    return (
      <div className="mx-auto max-w-7xl space-y-4 px-6 py-8">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="no-print sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <Link href={homeFor(user)} className="flex items-center gap-2 text-base font-bold text-brand-950">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-500 text-xs font-bold text-white">
              Q
            </span>
            Salon Queue
          </Link>
          <nav className="flex flex-wrap gap-1">
            {NAV[user.role].map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                active={pathname === item.href}
              />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="hidden text-sm sm:block">
                <p className="font-medium leading-tight text-foreground">{user.name}</p>
                <p className="text-xs leading-tight text-muted-foreground">
                  {user.salonName ?? 'Platform'}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" type="button" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

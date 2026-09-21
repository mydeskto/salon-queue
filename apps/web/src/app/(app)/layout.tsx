"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { UserRole } from '@salon/shared';
import { useAuth } from '@/lib/auth';
import { NavLink } from '@/components/ui';

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
    { href: '/reception', label: 'Live queue' },
  ],
  receptionist: [
    { href: '/reception', label: 'Live queue' },
    { href: '/reception/appointments', label: 'Appointments' },
    { href: '/reception/bills', label: 'Bills' },
  ],
  employee: [{ href: '/reception', label: 'Live queue' }],
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return <p className="p-10 text-slate-500">Loading…</p>;
  }

  return (
    <div className="min-h-screen">
      <header className="no-print border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <Link href="/" className="text-base font-semibold">
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
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-slate-500">
              {user.name}
              {user.salonName ? ` · ${user.salonName}` : ' · platform'}
            </span>
            <button className="btn-secondary" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

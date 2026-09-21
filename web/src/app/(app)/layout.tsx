"use client";

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CalendarClock,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorSmartphone,
  Receipt,
  ScissorsSquare,
  Search,
  Settings,
  Sparkles,
  Store,
  Users,
  X,
} from 'lucide-react';
import type { UserRole } from '@shared/index';
import { homeFor, useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const NAV: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: '/super', label: 'Platform', icon: LayoutDashboard },
    { href: '/super/salons', label: 'Salons', icon: Store },
  ],
  salon_admin: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/employees', label: 'Employees', icon: Users },
    { href: '/admin/chairs', label: 'Chairs', icon: ScissorsSquare },
    { href: '/admin/services', label: 'Services', icon: Sparkles },
    { href: '/admin/staff', label: 'Reception & screens', icon: MonitorSmartphone },
    { href: '/admin/customers', label: 'Customers', icon: Building2 },
    { href: '/admin/branding', label: 'Branding', icon: Settings },
    { href: '/reception', label: 'Live queue', icon: CalendarClock },
  ],
  receptionist: [
    { href: '/reception', label: 'Live queue', icon: CalendarClock },
    { href: '/reception/appointments', label: 'Appointments', icon: CalendarClock },
    { href: '/reception/bills', label: 'Bills', icon: Receipt },
  ],
  employee: [{ href: '/reception', label: 'Live queue', icon: CalendarClock }],
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
      <div className="flex h-screen overflow-hidden">
        <div className="hidden w-64 shrink-0 bg-brand-950 lg:block" />
        <div className="mx-auto w-full max-w-7xl space-y-4 overflow-y-auto px-6 py-8">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  const nav = NAV[user.role];

  const sidebarContent = (
    <>
      <div className="flex shrink-0 items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
          Q
        </span>
        <span className="text-base font-bold tracking-tight">Salon Queue</span>
      </div>

      <div className="mx-4 mb-4 flex shrink-0 items-center justify-between rounded-lg bg-white/5 px-3 py-2.5 text-sm">
        <span className="truncate font-medium text-white/90">{user.salonName ?? 'Platform'}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-white/40" />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-white/60 hover:bg-white/5 hover:text-white"
          type="button"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      {/* Desktop sidebar — fixed height, never scrolls with the page */}
      <aside className="no-print hidden h-screen w-64 shrink-0 flex-col bg-brand-950 text-white lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar drawer */}
      {mobileNavOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-brand-950 text-white">
            <button
              aria-label="Close menu"
              className="absolute right-3 top-5 text-white/60 hover:text-white"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {/* Main column — header stays put, only the content area scrolls */}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="no-print shrink-0 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-4">
            <button
              aria-label="Open menu"
              className="text-muted-foreground hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search…" className="pl-9" disabled />
            </div>
            <div className="ml-auto flex items-center gap-2">
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
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 overflow-y-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { statusLabel, statusVariant } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant={statusVariant(status)} className={cn('capitalize', className)}>
      {statusLabel(status)}
    </Badge>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

const GRADIENT_TONES = {
  purple: 'from-brand-600 to-brand-800',
  violet: 'from-brand-400 to-brand-600',
  orange: 'from-accent-400 to-accent-600',
  slate: 'from-slate-500 to-slate-700',
} as const;

export type GradientTone = keyof typeof GRADIENT_TONES;

/** Reference-style gradient KPI card with a large watermark icon in the corner. */
export function GradientStat({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: GradientTone;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-gradient-to-br p-5 text-white shadow-sm',
        GRADIENT_TONES[tone],
      )}
    >
      <Icon className="absolute -right-3 -top-3 h-24 w-24 text-white/10" />
      <p className="relative text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </p>
      <p className="relative mt-2 text-3xl font-bold">{value}</p>
      {hint ? <p className="relative mt-1 text-xs text-white/70">{hint}</p> : null}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
      )}
    >
      {label}
    </Link>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export { CardTitle, CardHeader };

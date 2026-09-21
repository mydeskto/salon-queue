export function money(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  const safe = Number.isFinite(amount) ? amount : 0;
  // PKR is conventionally shown without decimals for everyday amounts.
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(safe);
  return `Rs ${formatted}`;
}

export function clockTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function dateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function minutesSince(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export type StatusBadgeVariant =
  | 'default'
  | 'secondary'
  | 'accent'
  | 'outline'
  | 'success'
  | 'warning'
  | 'info'
  | 'destructive'
  | 'muted';

export function statusVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case 'waiting':
      return 'warning';
    case 'in_service':
      return 'info';
    case 'awaiting_payment':
      return 'accent';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'muted';
    case 'free':
      return 'success';
    case 'occupied':
      return 'info';
    case 'disabled':
      return 'muted';
    case 'active':
      return 'success';
    case 'suspended':
      return 'destructive';
    default:
      return 'secondary';
  }
}

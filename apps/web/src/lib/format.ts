export function money(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
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

export function statusClasses(status: string): string {
  switch (status) {
    case 'waiting':
      return 'bg-amber-100 text-amber-800';
    case 'in_service':
      return 'bg-blue-100 text-blue-800';
    case 'awaiting_payment':
      return 'bg-purple-100 text-purple-800';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    case 'cancelled':
      return 'bg-slate-200 text-slate-600';
    case 'free':
      return 'bg-emerald-100 text-emerald-800';
    case 'occupied':
      return 'bg-blue-100 text-blue-800';
    case 'disabled':
      return 'bg-slate-200 text-slate-600';
    case 'active':
      return 'bg-emerald-100 text-emerald-800';
    case 'suspended':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

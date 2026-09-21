"use client";

import type { Bill } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner } from '@/components/ui';

export default function BillsPage() {
  const bills = useLoader<Bill[]>(() => api<Bill[]>('/api/bills'), []);

  async function reprint(billId: string) {
    await api(`/api/bills/${billId}/print`, { method: 'POST' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Bills</h1>
      <ErrorBanner message={bills.error} />
      {bills.data?.length === 0 ? <Empty>No bills yet today.</Empty> : null}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Token</th>
              <th className="th">Customer</th>
              <th className="th">Stylist</th>
              <th className="th">Total</th>
              <th className="th">Paid</th>
              <th className="th" />
            </tr>
          </thead>
          <tbody>
            {(bills.data ?? []).map((bill) => (
              <tr key={bill.id}>
                <td className="td font-semibold">{bill.tokenNumber}</td>
                <td className="td">{bill.customerName ?? '—'}</td>
                <td className="td">{bill.employeeName ?? '—'}</td>
                <td className="td">{money(bill.total)}</td>
                <td className="td">{dateTime(bill.createdAt)}</td>
                <td className="td text-right">
                  <button className="btn-secondary" type="button" onClick={() => reprint(bill.id)}>
                    Reprint
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

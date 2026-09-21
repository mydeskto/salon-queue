"use client";

import type { CustomerDirectoryRow } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { dateTime, money } from '@/lib/format';
import { Empty, ErrorBanner } from '@/components/ui';

export default function CustomersPage() {
  const customers = useLoader<CustomerDirectoryRow[]>(
    () => api<CustomerDirectoryRow[]>('/api/reports/customers'),
    [],
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Customers</h1>
      <ErrorBanner message={customers.error} />
      {customers.data?.length === 0 ? (
        <Empty>No customer phone numbers captured yet.</Empty>
      ) : null}
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Phone</th>
              <th className="th">Name</th>
              <th className="th">Visits</th>
              <th className="th">Total spend</th>
              <th className="th">Last visit</th>
            </tr>
          </thead>
          <tbody>
            {(customers.data ?? []).map((row) => (
              <tr key={row.customerPhone}>
                <td className="td font-medium">{row.customerPhone}</td>
                <td className="td">{row.customerName ?? '—'}</td>
                <td className="td">{row.visits}</td>
                <td className="td">{money(row.totalSpend)}</td>
                <td className="td">{dateTime(row.lastVisitAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

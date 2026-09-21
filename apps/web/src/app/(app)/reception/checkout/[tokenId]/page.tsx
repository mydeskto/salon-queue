"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Bill, PaymentMethod, TokenSummary } from '@salon/shared';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner } from '@/components/ui';

interface BillResponse {
  bill: Bill;
  receiptText: string;
  print: { printed: boolean; reason?: string };
}

const METHODS: PaymentMethod[] = ['cash', 'card', 'upi', 'other'];

export default function CheckoutPage() {
  const params = useParams<{ tokenId: string }>();
  const router = useRouter();
  const token = useLoader<TokenSummary>(
    () => api<TokenSummary>(`/api/tokens/${params.tokenId}`),
    [params.tokenId],
  );

  const [prices, setPrices] = useState<Record<string, string>>({});
  const [discount, setDiscount] = useState('0');
  const [taxRate, setTaxRate] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [result, setResult] = useState<BillResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token.data) return;
    setPrices(
      Object.fromEntries(token.data.services.map((service) => [service.serviceId, service.price])),
    );
  }, [token.data]);

  const subtotal = Object.values(prices).reduce((sum, value) => sum + Number(value || 0), 0);
  const taxed = Math.max(0, subtotal - Number(discount || 0)) * (Number(taxRate || 0) / 100);
  const total = Math.max(0, subtotal - Number(discount || 0)) + taxed;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await api<BillResponse>('/api/bills', {
        method: 'POST',
        body: {
          tokenId: params.tokenId,
          discount: Number(discount || 0).toFixed(2),
          taxRate: Number(taxRate || 0),
          paymentMethod,
          items: Object.entries(prices).map(([serviceId, price]) => ({
            serviceId,
            price: Number(price || 0).toFixed(2),
          })),
        },
      });
      setResult(response);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <div className="card print-area">
          <pre className="whitespace-pre-wrap font-mono text-xs">{result.receiptText}</pre>
        </div>
        <p className="no-print text-sm text-slate-500">
          {result.print.printed
            ? 'Sent to the thermal printer.'
            : `Thermal printing unavailable (${result.print.reason ?? 'disabled'}) — use browser print.`}
        </p>
        <div className="no-print flex gap-3">
          <button className="btn-secondary flex-1" type="button" onClick={() => window.print()}>
            Print receipt
          </button>
          <button
            className="btn-primary flex-1"
            type="button"
            onClick={() => router.push('/reception')}
          >
            Back to queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-semibold">
        Checkout {token.data ? token.data.tokenNumber : ''}
      </h1>
      <ErrorBanner message={error ?? token.error} />
      <div className="card space-y-3">
        {(token.data?.services ?? []).map((service) => (
          <div key={service.serviceId} className="flex items-center justify-between gap-3">
            <span className="text-sm">{service.name}</span>
            <input
              className="input w-28 text-right"
              value={prices[service.serviceId] ?? ''}
              onChange={(event) =>
                setPrices((current) => ({ ...current, [service.serviceId]: event.target.value }))
              }
            />
          </div>
        ))}
      </div>
      <div className="card grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="discount">
            Discount
          </label>
          <input
            id="discount"
            className="input"
            value={discount}
            onChange={(event) => setDiscount(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="tax">
            Tax %
          </label>
          <input
            id="tax"
            className="input"
            value={taxRate}
            onChange={(event) => setTaxRate(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="method">
            Payment
          </label>
          <select
            id="method"
            className="input"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
          >
            {METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="card space-y-1 text-sm">
        <p className="flex justify-between">
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </p>
        <p className="flex justify-between">
          <span>Discount</span>
          <span>-{money(Number(discount || 0))}</span>
        </p>
        <p className="flex justify-between">
          <span>Tax</span>
          <span>{money(taxed)}</span>
        </p>
        <p className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{money(total)}</span>
        </p>
      </div>
      <button className="btn-primary w-full btn-xl" type="submit" disabled={busy}>
        {busy ? 'Completing…' : 'Take payment & print'}
      </button>
    </form>
  );
}

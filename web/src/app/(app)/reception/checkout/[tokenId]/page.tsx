"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';
import type { Bill, PaymentMethod, TokenSummary } from '@shared/index';
import { api } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

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

  if (token.loading) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <Card className="print-area">
          <CardContent className="pt-5">
            <pre className="whitespace-pre-wrap font-mono text-xs">{result.receiptText}</pre>
          </CardContent>
        </Card>
        <p className="no-print text-sm text-muted-foreground">
          {result.print.printed
            ? 'Sent to the thermal printer.'
            : `Thermal printing unavailable (${result.print.reason ?? 'disabled'}) — use browser print.`}
        </p>
        <div className="no-print flex gap-3">
          <Button variant="outline" className="flex-1" type="button" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print receipt
          </Button>
          <Button className="flex-1" type="button" onClick={() => router.push('/reception')}>
            Back to queue
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">
        Checkout {token.data ? token.data.tokenNumber : ''}
      </h1>
      <ErrorBanner message={error ?? token.error} />
      <Card>
        <CardContent className="space-y-3 pt-5">
          {(token.data?.services ?? []).map((service) => (
            <div key={service.serviceId} className="flex items-center justify-between gap-3">
              <span className="text-sm">{service.name}</span>
              <Input
                className="w-28 text-right"
                value={prices[service.serviceId] ?? ''}
                onChange={(event) =>
                  setPrices((current) => ({ ...current, [service.serviceId]: event.target.value }))
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div>
            <Label htmlFor="discount">Discount</Label>
            <Input id="discount" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="tax">Tax %</Label>
            <Input id="tax" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
          </div>
          <div>
            <Label htmlFor="method">Payment</Label>
            <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((method) => (
                  <SelectItem key={method} value={method} className="capitalize">
                    {method}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-1 pt-5 text-sm">
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
        </CardContent>
      </Card>
      <Button className="w-full" size="xl" type="submit" disabled={busy}>
        {busy ? 'Completing…' : 'Take payment & print'}
      </Button>
    </form>
  );
}

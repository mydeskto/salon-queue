"use client";

import { useRef, useState } from 'react';
import { Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@shared/index';
import { api, mediaUrl } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { money } from '@/lib/format';
import { ErrorBanner, Section } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  const response = await fetch(`${BASE}/api/uploads/image`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? 'Upload failed');
  }
  return payload.url as string;
}

export default function ServicesPage() {
  const services = useLoader<Service[]>(() => api<Service[]>('/api/services'), []);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [durationMinutes, setDuration] = useState('30');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setImageUrl(url);
      toast.success('Photo uploaded');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api('/api/services', {
        method: 'POST',
        body: {
          name,
          price: Number(price || 0).toFixed(2),
          durationMinutes: Number(durationMinutes),
          category: category || undefined,
          imageUrl: imageUrl || undefined,
        },
      });
      setName('');
      setPrice('');
      setCategory('');
      setImageUrl(null);
      services.reload();
      toast.success(`${name} added to the catalogue`);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(service: Service) {
    setError(null);
    try {
      await api(`/api/services/${service.id}`, {
        method: 'PATCH',
        body: { isActive: !service.isActive },
      });
      services.reload();
      toast.success(service.isActive ? `${service.name} hidden` : `${service.name} restored`);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Services</h1>
        <p className="text-sm text-muted-foreground">
          The price list customers see on the kiosk check-in screen.
        </p>
      </div>
      <ErrorBanner message={error ?? services.error} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-5">
            <div className="sm:col-span-5">
              <Label>Photo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-border bg-secondary">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={mediaUrl(imageUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No photo</span>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={pickFile}
                    className="hidden"
                    id="svc-photo-upload"
                  />
                  <Button asChild variant="outline" type="button" disabled={uploading} size="sm">
                    <label htmlFor="svc-photo-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload photo'}
                    </label>
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">Optional. PNG, JPEG, or WEBP, up to 5MB.</p>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="svc-name">Name</Label>
              <Input id="svc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="svc-category">Category</Label>
              <Input id="svc-category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="svc-price">Price (PKR)</Label>
              <Input
                id="svc-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="svc-duration">Minutes</Label>
              <Input
                id="svc-duration"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
            <Button className="sm:col-span-5" type="submit" disabled={saving || uploading}>
              <Plus className="h-4 w-4" /> {saving ? 'Adding…' : 'Add service'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Section title="Catalogue" description={`${services.data?.length ?? 0} service(s)`}>
        <Card>
          {services.loading ? (
            <CardContent className="space-y-2 pt-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead />
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(services.data ?? []).map((service) => (
                  <TableRow key={service.id}>
                    <TableCell>
                      <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                        {service.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(service.imageUrl) ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-[9px] text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.category ?? '—'}</TableCell>
                    <TableCell>{money(service.price)}</TableCell>
                    <TableCell>{service.durationMinutes} min</TableCell>
                    <TableCell>
                      <Badge variant={service.isActive ? 'success' : 'muted'}>
                        {service.isActive ? 'Active' : 'Hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" type="button" onClick={() => toggle(service)}>
                        {service.isActive ? 'Hide' : 'Restore'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </Section>
    </div>
  );
}

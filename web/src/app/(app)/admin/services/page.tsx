"use client";

import { useRef, useState } from 'react';
import { ImageOff, Plus, Sparkles, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@shared/index';
import { api, mediaUrl } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { useFullWidthPage } from '@/lib/page-width';
import { money } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Empty, ErrorBanner, Section } from '@/components/ui';
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
  useFullWidthPage();
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
    // useFullWidthPage() (above) tells the shared (app) layout to drop its
    // max-w-7xl cap just while this page is mounted, so the catalogue can
    // use the entire window instead of being capped like other admin pages.
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-sm text-muted-foreground">
            The price list customers see on the kiosk check-in screen.
          </p>
        </div>
        <Badge variant="muted" className="h-fit">
          {services.data?.length ?? 0} service{services.data?.length === 1 ? '' : 's'}
        </Badge>
      </div>
      <ErrorBanner message={error ?? services.error} />

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={create} className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border bg-secondary">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaUrl(imageUrl) ?? undefined} alt="" className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 space-y-1">
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
                <p className="text-xs text-muted-foreground">Optional. PNG, JPEG, or WEBP, up to 5MB.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <Label htmlFor="svc-name">Name</Label>
                <Input
                  id="svc-name"
                  className="mt-1.5"
                  placeholder="e.g. Haircut"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="svc-category">Category</Label>
                <Input
                  id="svc-category"
                  className="mt-1.5"
                  placeholder="e.g. Hair"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="svc-price">Price (PKR)</Label>
                <Input
                  id="svc-price"
                  className="mt-1.5"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="svc-duration">Duration (min)</Label>
                <Input
                  id="svc-duration"
                  className="mt-1.5"
                  inputMode="numeric"
                  value={durationMinutes}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                />
              </div>
              <Button className="self-end sm:col-span-1" type="submit" disabled={saving || uploading}>
                <Plus className="h-4 w-4" /> {saving ? 'Adding…' : 'Add service'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Section title="Catalogue">
        <Card className="overflow-hidden">
          {services.loading ? (
            <CardContent className="space-y-3 pt-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          ) : (services.data ?? []).length === 0 ? (
            <CardContent className="pt-6">
              <Empty>
                <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                No services yet — add your first one above.
              </Empty>
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16" />
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(services.data ?? []).map((service) => (
                  <TableRow key={service.id} className={cn(!service.isActive && 'opacity-60')}>
                    <TableCell>
                      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary">
                        {service.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={mediaUrl(service.imageUrl) ?? undefined}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageOff className="h-4 w-4 text-muted-foreground/40" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{service.name}</TableCell>
                    <TableCell className="text-muted-foreground">{service.category ?? '—'}</TableCell>
                    <TableCell className="font-medium">{money(service.price)}</TableCell>
                    <TableCell className="text-muted-foreground">{service.durationMinutes} min</TableCell>
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

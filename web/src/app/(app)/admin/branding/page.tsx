"use client";

import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Salon } from '@shared/index';
import { api, mediaUrl } from '@/lib/api';
import { useLoader } from '@/lib/usePolling';
import { ErrorBanner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

export default function BrandingPage() {
  const salon = useLoader<Salon>(() => api<Salon>('/api/salons/me'), []);
  const fileInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salon.data || hydrated) return;
    setName(salon.data.name);
    setAddress(salon.data.address ?? '');
    setPhone(salon.data.phone ?? '');
    setLogoUrl(salon.data.logoUrl);
    setHydrated(true);
  }, [salon.data, hydrated]);

  async function pickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      setLogoUrl(url);
      toast.success('Photo uploaded — save to apply it');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/salons/me', {
        method: 'PATCH',
        body: {
          name,
          address: address || null,
          phone: phone || null,
          logoUrl: logoUrl || null,
        },
      });
      toast.success('Branding saved — the kiosk screen picks this up automatically');
      salon.reload();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (salon.loading && !hydrated) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Salon branding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This name and photo are what customers see on the kiosk screen after it signs in.
        </p>
      </div>
      <ErrorBanner message={error ?? salon.error} />

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={save} className="space-y-5">
            <div>
              <Label>Salon photo / logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-border bg-secondary">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mediaUrl(logoUrl) ?? undefined}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">No photo</span>
                  )}
                </div>
                <div>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={pickFile}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button asChild variant="outline" type="button" disabled={uploading}>
                    <label htmlFor="logo-upload" className="cursor-pointer">
                      <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload photo'}
                    </label>
                  </Button>
                  <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, or WEBP. Up to 5MB.</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="salon-name">Salon name</Label>
              <Input id="salon-name" value={name} onChange={(event) => setName(event.target.value)} required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="salon-address">Address</Label>
                <Input id="salon-address" value={address} onChange={(event) => setAddress(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="salon-phone">Phone</Label>
                <Input id="salon-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? 'Saving…' : 'Save branding'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

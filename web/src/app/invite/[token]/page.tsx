"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import type { AuthResponse } from '@shared/index';
import { api } from '@/lib/api';
import { homeFor } from '@/lib/auth';
import { ErrorBanner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

interface InviteInfo {
  name: string;
  email: string;
}

export default function AcceptInvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [checking, setChecking] = useState(true);
  const [invalidReason, setInvalidReason] = useState<string | null>(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<InviteInfo>(`/api/auth/invites/${params.token}`, { auth: false })
      .then(setInfo)
      .catch((cause: Error) => setInvalidReason(cause.message))
      .finally(() => setChecking(false));
  }, [params.token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<AuthResponse>('/api/auth/invites/accept', {
        method: 'POST',
        body: { token: params.token, password },
        auth: false,
      });
      router.push(homeFor(result.user));
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
      <div className="w-full max-w-sm">
        {checking ? (
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : invalidReason ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-foreground">Invite link invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">{invalidReason}</p>
            <p className="mt-4 text-sm text-muted-foreground">
              Ask your salon admin to resend the invite.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-foreground">Welcome, {info?.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a password for {info?.email} to finish setting up your account.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <ErrorBanner message={error} />
              <div>
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  minLength={8}
                  required
                />
              </div>
              <Button className="w-full" size="lg" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
                  </>
                ) : (
                  <>
                    Set password &amp; sign in <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

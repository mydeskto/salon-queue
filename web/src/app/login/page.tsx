"use client";

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { homeFor, useAuth } from '@/lib/auth';
import { ErrorBanner } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SAFE_REDIRECT_PREFIXES = ['/admin', '/reception', '/super'];

/** Only follow `next` if it's a same-origin path under a known protected area. */
function safeRedirect(next: string | null): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  return SAFE_REDIRECT_PREFIXES.some((prefix) => next === prefix || next.startsWith(`${prefix}/`))
    ? next
    : null;
}

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password);
      const next = safeRedirect(searchParams.get('next'));
      router.push(next ?? homeFor(user));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-5">
      <ErrorBanner message={error} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>
      <Button className="w-full" size="lg" type="submit" disabled={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          <>
            Sign in <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Left: brand banner */}
      <div className="kiosk-shell relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />

        <p className="relative text-lg font-bold tracking-tight">Salon Queue</p>

        <div className="relative animate-fade-in">
          <span className="kiosk-badge">Multi-salon platform</span>
          <h1 className="mt-5 max-w-md text-4xl font-bold leading-tight tracking-tight">
            Check-in, chairs, and billing — all in one queue.
          </h1>
          <p className="mt-4 max-w-sm text-white/70">
            Kiosk check-in, automatic chair assignment, reception billing, and real-time
            reporting for every salon on the platform.
          </p>
        </div>

        <p className="relative text-sm text-white/50">
          &copy; {new Date().getFullYear()} Salon Queue
        </p>
      </div>

      {/* Right: sign in */}
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-brand-950">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Reception, salon admin, platform admin, or a kiosk screen.
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';
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

function ReceptionLoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <ErrorBanner message={error} />
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          className="border-transparent bg-secondary/70 focus-visible:border-input focus-visible:bg-background"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            className="border-transparent bg-secondary/70 pr-10 focus-visible:border-input focus-visible:bg-background"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button
        className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
        size="lg"
        type="submit"
        disabled={busy}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          'Sign in'
        )}
      </Button>
    </form>
  );
}

export default function ReceptionLoginPage() {
  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-2">
      {/* Left: solid brand panel */}
      <div className="relative hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <Link href="/login" className="flex items-center gap-2 text-sm text-white/70 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>

        <blockquote className="max-w-sm text-lg italic leading-relaxed text-white/80">
          &ldquo;The queue is the first impression. Make it effortless.&rdquo;
          <footer className="mt-3 text-sm not-italic text-white/50">— Salon Queue</footer>
        </blockquote>
      </div>

      {/* Right: sign in */}
      <div className="flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link
            href="/login"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-foreground">Receptionist sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Run the live queue, take payments, and manage appointments.
            </p>
          </div>
          <Suspense fallback={null}>
            <ReceptionLoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

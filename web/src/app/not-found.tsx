import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="kiosk-shell flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg animate-fade-in text-center">
        <p className="kiosk-badge mx-auto">Error 404</p>
        <p className="mt-6 text-8xl font-extrabold tracking-tight text-white">404</p>
        <h1 className="mt-4 text-2xl font-bold text-white">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-white/70">
          The link may be out of date, or the page may have moved. Check the address, or head
          back to one of these.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <Link href="/" className="kiosk-card !p-4 hover:shadow-2xl">
            <p className="font-semibold text-brand-900">Home</p>
            <p className="text-xs text-slate-500">Landing page</p>
          </Link>
          <Link href="/kiosk" className="kiosk-card !p-4 hover:shadow-2xl">
            <p className="font-semibold text-brand-900">Kiosk</p>
            <p className="text-xs text-slate-500">Salon check-in</p>
          </Link>
          <Link href="/login" className="kiosk-card !p-4 hover:shadow-2xl">
            <p className="font-semibold text-brand-900">Sign in</p>
            <p className="text-xs text-slate-500">Staff &amp; admin</p>
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from 'next/link';

const entries = [
  { href: '/kiosk', title: 'Customer Kiosk', body: 'Walk in, pick services, get a token.' },
  { href: '/login', title: 'Reception', body: 'Live queue, chair control, checkout and printing.' },
  { href: '/login', title: 'Salon Admin', body: 'Staff, chairs, services and reports.' },
  { href: '/login', title: 'Super Admin', body: 'Provision salons and watch the platform.' },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="text-3xl font-semibold">Salon Queue</h1>
      <p className="mt-2 text-slate-600">
        Kiosk check-in, automatic chair assignment, reception billing, and multi-salon reporting.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {entries.map((entry) => (
          <Link key={entry.title} href={entry.href} className="card hover:border-ink">
            <p className="text-base font-semibold">{entry.title}</p>
            <p className="mt-1 text-sm text-slate-600">{entry.body}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

# Salon Queue, Token & Management System

Multi-tenant salon platform: kiosk check-in → automatic chair assignment → service →
reception billing (thermal or browser print), with real-time boards and reporting for
salon admins and a platform super admin.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js 14 (App Router), TypeScript, Tailwind |
| API | Express 4, TypeScript |
| DB | PostgreSQL + Drizzle ORM |
| Realtime | Socket.IO, one room per salon |
| Auth | JWT + role-based access control |
| Printing | ESC/POS (`node-thermal-printer`) with browser-print fallback |

```
server           Express REST API + Socket.IO — fully standalone project
server/db        Drizzle schema, migrations, seed
server/shared    Enums, Zod schemas, API/event types (server's local copy)
web              Next.js front end (kiosk, reception, salon admin, super admin) — fully standalone project
web/shared       Enums, Zod schemas, API/event types (web's local copy)
```

`server` and `web` are two completely independent projects, each with its own
`package.json`, lockfile, `node_modules`, `tsconfig.json`, and `.env`. There is
no root-level install or workspace orchestration — install and run each one
from inside its own folder.

`shared` is intentionally duplicated into each app rather than kept as a
shared package, so `web` and `server` don't depend on each other at all.
Keep the two copies in sync by hand when the shared types/schemas change.

## Setup

```bash
# 1. Node 20 + PostgreSQL 14+ running locally
createuser salon --createdb   # or use your own role
createdb salon -O salon

# 2. Server
cd server
cp .env.example .env          # edit DATABASE_URL / JWT_SECRET
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:4000

# 3. Web (separate terminal)
cd web
cp .env.example .env
npm install
npm run dev                   # http://localhost:3000
```

Useful scripts (run from inside `server/` or `web/` respectively):
`npm run db:generate` (new migration from schema changes, server only),
`npm run typecheck`, `npm run lint` (web only), `npm run build`,
`./scripts/smoke.sh` (end-to-end API check against a running server, run from repo root).

### Demo logins (from the seed, password `password123`)

| Role | Email |
| --- | --- |
| Super admin | `super@salonqueue.test` |
| Salon admin (Downtown Cuts) | `admin@downtowncuts.test` |
| Receptionist (Downtown Cuts) | `reception@downtowncuts.test` |
| Salon admin (Riverside) | `admin@riverside.test` |
| Receptionist (Riverside) | `reception@riverside.test` |

Kiosk needs no login: <http://localhost:3000/kiosk>.

## Thermal printing

Printing is off by default and the UI falls back to `window.print()` of the rendered
receipt. To drive an ESC/POS printer set in `.env`:

```env
ESCPOS_ENABLED=true
ESCPOS_INTERFACE=tcp://192.168.1.50:9100   # or printer:auto / /dev/usb/lp0
ESCPOS_WIDTH=42
```

Every bill response also returns `receiptText`, so reprints work from
**Reception → Bills → Reprint** whether or not a printer is attached.

## Domain rules

- **Token numbers** are per salon per day (`A-001`, `A-002`, …). They are allocated
  inside a transaction that locks the salon row, so concurrent kiosk check-ins cannot
  collide.
- **Chair assignment** at check-in picks a free chair whose employee is on shift and
  qualified for every requested service. If the customer asked for a specific stylist
  and that stylist is busy, the token stays `waiting` until they free up.
- **Status flow**: `waiting → in_service → awaiting_payment → completed`, with
  `cancelled` reachable from any live state. Only receptionists/salon admins move
  tokens, and `completed` is reachable *only* by creating the bill — that is what
  releases the chair and pulls the next waiting token in.
- **Prices are snapshotted** on the token at check-in and again on the bill, so later
  price-list edits never rewrite history.
- **Tenant isolation**: every authenticated route resolves the caller's salon from
  their JWT; a client-supplied `salonId` that differs is rejected with 403. Only the
  super admin may target an arbitrary salon, and they see aggregates only — never
  customer rows inside a tenant.
- **Socket rooms**: staff join `salon:{id}` (full token/bill events) after their JWT is
  verified; anonymous kiosk clients join `salon:{id}:public`, which carries only queue
  positions and chair availability — no customer names or phone numbers.

## API surface

| Area | Routes |
| --- | --- |
| Auth | `POST /api/auth/login`, `GET /api/auth/me` |
| Kiosk (public) | `GET /api/kiosk/salons`, `GET /api/kiosk/:salonId`, `GET /api/kiosk/:salonId/queue`, `POST /api/kiosk/check-in`, `GET /api/kiosk/tokens/:id`, `POST /api/kiosk/appointments`, `GET /api/kiosk/:salonId/appointments?phone=` |
| Queue | `GET/POST /api/tokens`, `GET /api/tokens/queue`, `PATCH /api/tokens/:id/status`, `POST /api/tokens/:id/assign` |
| Billing | `POST /api/bills`, `GET /api/bills`, `GET /api/bills/:id`, `POST /api/bills/:id/print` |
| Salon admin | `/api/services`, `/api/chairs`, `/api/employees`, `/api/staff`, `/api/appointments` |
| Reports | `GET /api/reports/overview`, `/api/reports/customers`, `/api/reports/my-shift` |
| Super admin | `GET /api/salons`, `GET /api/salons/overview`, `POST /api/salons`, `PATCH /api/salons/:id`, `DELETE /api/salons/:id` |

See [`TESTPLAN.md`](./TESTPLAN.md) for the manual QA checklist.

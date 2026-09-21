# Manual QA checklist

Seeded data assumed (`npm run db:seed`); password for every demo account is
`password123`. Run `npm run dev` and open two browser windows — one kiosk, one
reception — to watch real-time updates.

## 1. Kiosk check-in (auto chair)

1. Open <http://localhost:3000/kiosk> and pick **Downtown Cuts**.
2. Select one or more services; the footer total and duration update.
3. Leave the stylist as *No preference*, enter a name/phone, press **Get my token**.
4. Expect the ticket page to show `A-001`, a chair label and stylist, and a printable
   ticket (**Print ticket** opens the browser dialog with only the ticket on the page).
5. In the reception window the token appears under **Waiting** without a refresh.

## 2. Kiosk check-in (requested stylist / queueing)

1. Check in twice more so every chair is occupied.
2. Check in again — the ticket should show a queue position and estimated wait instead
   of a chair.
3. Check in requesting a specific stylist who is currently busy: the token must stay
   `waiting` even if another chair is free.

## 3. Reception queue flow

1. Sign in at `/login` as `reception@downtowncuts.test`.
2. For a waiting token with a chair, press **Start service** → status becomes
   *in service* and the chair shows occupied.
3. Press **Finish service** → token moves to **Awaiting payment**; the chair stays
   occupied (the customer is still there).
4. For a waiting token without a chair, use **Assign chair…** to place it manually.
5. **Cancel** a waiting token and confirm it leaves the board.

## 4. Checkout, discount, print

1. From **Awaiting payment**, press **Checkout**.
2. Edit a line price, set a discount (e.g. `2.00`) and tax (e.g. `5`); the totals
   recompute live.
3. Press **Take payment & print**. Expect: receipt text rendered, a note saying thermal
   printing is disabled (unless `ESCPOS_ENABLED=true`), token now `completed`, the chair
   freed, and the next waiting token pulled into that chair automatically.
4. **Reception → Bills → Reprint** returns the same receipt.

## 5. Advance booking

1. Kiosk → **Book for later**: choose services, name, phone, a future date/time, and
   optionally a stylist.
2. Search the same phone under **Find my booking** — the appointment is listed.
3. Reception → **Appointments** → **Check in now** converts it into a live token and
   marks the appointment `checked_in`.

## 6. Salon admin

1. Sign in as `admin@downtowncuts.test`.
2. **Services**: add a service, hide it, confirm it disappears from the kiosk menu.
3. **Chairs**: add a chair (kiosk free-chair count rises); disabling an occupied chair
   must be rejected.
4. **Employees**: create one with specialties and a shift, view their **History**,
   deactivate them and confirm they stop receiving assignments.
5. **Reception staff**: create a receptionist and sign in as them.
6. **Dashboard**: set a date range and verify tokens, revenue, average wait, chair
   utilisation, peak hours, per-employee and per-service tables.
7. **Customers**: repeat visits from the same phone number aggregate into one row.

## 7. Super admin

1. Sign in as `super@salonqueue.test`.
2. **Platform**: totals across both seeded salons.
3. **Salons**: provision a new salon — the returned admin credentials must work at
   `/login` and land on that salon's dashboard with zero data.
4. Suspend a salon: it disappears from the kiosk salon list and its staff can no longer
   sign in. Reactivate and confirm access returns.

## 8. Tenant isolation (must fail)

1. Sign in as `reception@riverside.test` and try to act on a Downtown Cuts token
   (e.g. `PATCH /api/tokens/<downtown-token>/status`) — expect **403**.
2. Repeat for `/api/bills`, `/api/chairs/:id/free`, and `?salonId=<other-salon>` on any
   list endpoint.
3. `./scripts/smoke.sh` automates the happy path plus this 403 check.

## 9. Concurrency

1. Fire several kiosk check-ins at once:
   `for i in 1 2 3 4 5; do curl -s -X POST … /api/kiosk/check-in & done`
2. Token numbers must be unique and consecutive, and no two tokens may share a chair.

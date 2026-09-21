#!/usr/bin/env bash
# End-to-end smoke test of the kiosk -> service -> checkout flow plus a
# cross-tenant isolation check. Requires the server running on $API.
set -euo pipefail

API="${API:-http://localhost:4000}"
PASSWORD="${SEED_PASSWORD:-password123}"

jqr() { python3 -c "import json,sys;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

echo "== login receptionist (Downtown Cuts)"
RECEPTION=$(curl -s -X POST "$API/api/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"reception@downtowncuts.test\",\"password\":\"$PASSWORD\"}")
RTOKEN=$(echo "$RECEPTION" | jqr "d['token']")
SALON=$(echo "$RECEPTION" | jqr "d['user']['salonId']")

echo "== login receptionist (Riverside)"
OTHER=$(curl -s -X POST "$API/api/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"reception@riverside.test\",\"password\":\"$PASSWORD\"}")
OTOKEN=$(echo "$OTHER" | jqr "d['token']")

echo "== kiosk menu"
INFO=$(curl -s "$API/api/kiosk/$SALON")
SERVICE=$(echo "$INFO" | jqr "d['services'][0]['id']")

echo "== kiosk check-in"
CHECKIN=$(curl -s -X POST "$API/api/kiosk/check-in" -H 'content-type: application/json' \
  -d "{\"salonId\":\"$SALON\",\"serviceIds\":[\"$SERVICE\"],\"customerName\":\"Smoke Test\",\"customerPhone\":\"+15550000\"}")
TOKEN_ID=$(echo "$CHECKIN" | jqr "d['token']['id']")
echo "   token $(echo "$CHECKIN" | jqr "d['token']['tokenNumber']") chair $(echo "$CHECKIN" | jqr "d['token']['chairLabel']")"

echo "== start service"
curl -s -X PATCH "$API/api/tokens/$TOKEN_ID/status" -H "authorization: Bearer $RTOKEN" \
  -H 'content-type: application/json' -d '{"status":"in_service"}' > /dev/null

echo "== finish service"
curl -s -X PATCH "$API/api/tokens/$TOKEN_ID/status" -H "authorization: Bearer $RTOKEN" \
  -H 'content-type: application/json' -d '{"status":"awaiting_payment"}' > /dev/null

echo "== cross-tenant check (expect 403)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$API/api/tokens/$TOKEN_ID/status" \
  -H "authorization: Bearer $OTOKEN" -H 'content-type: application/json' -d '{"status":"cancelled"}')
test "$CODE" = "403" || { echo "expected 403, got $CODE"; exit 1; }

echo "== bill + free chair"
BILL=$(curl -s -X POST "$API/api/bills" -H "authorization: Bearer $RTOKEN" \
  -H 'content-type: application/json' \
  -d "{\"tokenId\":\"$TOKEN_ID\",\"discount\":\"2.00\",\"taxRate\":5,\"paymentMethod\":\"card\"}")
echo "   total $(echo "$BILL" | jqr "d['bill']['total']")"

STATUS=$(curl -s "$API/api/kiosk/tokens/$TOKEN_ID" | jqr "d['token']['status']")
test "$STATUS" = "completed" || { echo "expected completed, got $STATUS"; exit 1; }

echo "OK"

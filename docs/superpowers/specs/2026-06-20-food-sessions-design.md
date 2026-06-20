# Food Sessions — Design Spec

Date: 2026-06-20

## Goal

Let an event optionally run **food sessions** — capacity-limited sittings in a food
hall. Admins create multiple sessions per event, each with a soft `limit` and a hard
`maxLimit`, and can hide/unhide them. A staff-operated mobile scanner scans an
attendee's existing ticket QR to admit them to food. Each attendee may eat **once per
event** (any session). The scan API returns live capacity stats and a flag the mobile
app uses to render the food screen.

## Decisions (locked)

- **Uniqueness:** once per event (total). Scanning into any session blocks all others.
- **Capacity:** `maxLimit` is a hard cap (scan rejected when full). `limit` is a soft
  warning threshold — once reached, responses flag "near capacity" but still admit
  until `maxLimit`.
- **Eligibility:** any registered attendee (a row in `EventRegistration`). No
  requirement that they were marked present at main attendance.
- **Scanner auth:** authenticated staff (`getAuthUser` + `requireEventAccess`), same
  model as the existing `/api/attendance/verify-qr`.
- **Delete session:** cascade-deletes that session's `FoodScan` records (mirrors how
  deleting an event cascades registrations/attendance).
- **Scope built here:** backend APIs + web admin dashboard. The camera scanner UI
  lives in the external mobile app, which wires against the documented contract.

## Data models

### Event (modified)
Add `foodSessionsEnabled: boolean` (default `false`).

### FoodSession (new — `src/lib/db/models/foodSession.ts`)
| field | type | notes |
|---|---|---|
| `eventId` | ObjectId ref Event | required |
| `name` | string | required, trimmed |
| `limit` | number | soft threshold, ≥ 0 |
| `maxLimit` | number | hard cap, ≥ 1, `limit ≤ maxLimit` |
| `isVisible` | boolean | default `true` |
| `count` | number | denormalized admitted count, atomic `$inc` |
| `createdAt` | Date | |

Indexes: `{eventId:1}`, `{eventId:1, isVisible:1}`.

### FoodScan (new — `src/lib/db/models/foodScan.ts`)
| field | type | notes |
|---|---|---|
| `eventId` | ObjectId | required |
| `foodSessionId` | ObjectId | required |
| `email` | string | lowercased snapshot |
| `regNo` | string | snapshot |
| `name` | string | snapshot |
| `scannedBy` | ObjectId | staff account id |
| `scannedAt` | Date | |

Indexes: **unique `{eventId:1, email:1}`** (enforces once-per-event), `{foodSessionId:1}`, `{eventId:1}`.

## APIs

### Admin (staff JWT; admin/event_admin)
- `POST /api/events` — accept optional `foodSessionsEnabled`.
- `PATCH /api/events/[eventId]/settings` — accept `foodSessionsEnabled`.
- `GET /api/events/[eventId]/food-sessions` — list sessions + per-session stats.
  `?activeOnly=1` → visible only (mobile app uses this).
- `POST /api/events/[eventId]/food-sessions` — `{name, limit, maxLimit}`.
- `PATCH /api/events/[eventId]/food-sessions/[sessionId]` — edit name/limit/maxLimit and/or `isVisible`.
- `DELETE /api/events/[eventId]/food-sessions/[sessionId]` — delete + cascade scans.

### Mobile-facing (staff JWT)
- Render flag: existing `GET /api/events/[eventId]` now returns `foodSessionsEnabled`.
- Session list: `GET /api/events/[eventId]/food-sessions?activeOnly=1`.
- Scan: `POST /api/events/[eventId]/food-sessions/[sessionId]/scan`, body `{ encryptedData }`.

#### Scan logic
1. Session exists, belongs to event, `isVisible` → else `Session not available`.
2. Registration found by `qrPayload`, `eventId` matches → else invalid / wrong event.
3. Existing `FoodScan` for `(eventId,email)` → `409 { alreadyScanned, scannedAt, scannedSessionName }`.
4. Atomic reserve: `findOneAndUpdate({_id, isVisible:true, count:{$lt:maxLimit}}, {$inc:{count:1}}, {new:true})`; null → `409 { full:true }`.
5. Create `FoodScan`; on duplicate-key race, roll back `$inc` and return `alreadyScanned`.
6. Success:
```jsonc
{
  "ok": true,
  "renderFoodScreen": true,
  "attendee": { "name", "regNo", "email" },
  "session": { "id", "name", "limit", "maxLimit", "count" },
  "stats": { "admitted", "remainingToLimit", "remainingToMax", "nearLimit", "full" }
}
```

## Admin dashboard UI
- Create Event dialog: "Enable food sessions" checkbox.
- Event detail page: "Enable Food Sessions" toggle; when on, a **Food Sessions card** —
  Add Session dialog, list with `count → limit → max` progress, visible/hidden Switch,
  Edit, Delete. Wired with Tanstack Query.

## Seed / indexes
Add `foodSessionsEnabled` to seed `EventSchema`; add `FoodSession` + `FoodScan` schemas,
indexes, and `createIndexes()` calls.

## Edge cases
Validation (`limit ≤ maxLimit`, `maxLimit ≥ 1`, non-negative ints); hidden sessions
excluded from list and rejected at scan; once-per-event race-safe (unique index +
dup-key rollback); capacity race-safe (conditional atomic `$inc`); QR-not-in-event rejected.

## Verification
No test runner in repo. Verify with `npm run lint` + `npm run build` (type-check), plus
manual `curl` against scan/list endpoints. Update CLAUDE.md with a "Food sessions" section.

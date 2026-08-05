# Synk performance budgets

Synk treats the targets in specification §19 as release gates:

- meeting page p95 below 1,000 ms;
- participant availability update visible to the organizer over Socket.IO in
  under 100 ms p95;
- hundreds of simultaneous participants on one meeting;
- bounded, non-N+1 heatmap aggregation.

Availability editing is intentionally write-bounded: the browser waits for an
idle pause, sends at most one autosave every five seconds, never queues a second
save while one is in flight, and honors `Retry-After` after a 429. The API then
skips identical responses and persists only the quarter-hour rows that changed.
Organizer realtime refreshes are coalesced to at most once per second, preventing
a response burst from turning into one full meeting query per participant.

The meeting and invitation routes dynamically import their schedule grids, so
the Framer Motion calendar code is emitted as separate client chunks. Meeting
detail uses one Prisma relation query with a narrow participant/availability
projection. The in-process aggregation benchmark covers 300 participants and a
992-cell grid, and the database schema contains the required indexes on
`meetings.slug`, `participants.meeting_id`, and
`availabilities.participant_id` (plus the compound query indexes).

Run the repeatable end-to-end load test against a disposable meeting. Write
requests default to 30 per minute per organizer/participant identity and reads
default to 120. Start a disposable load-test API with
`GLOBAL_RATE_LIMIT=100000` and `GLOBAL_READ_RATE_LIMIT=100000`; never use these
overrides in production.

```powershell
$env:LOAD_TEST_MEETING_SLUG="invitation-slug"
$env:LOAD_TEST_MEETING_ID="meeting-database-id"
$env:LOAD_TEST_ORGANIZER_COOKIE="synk_access=..."
$env:LOAD_TEST_PARTICIPANTS="300"
pnpm run performance:load
```

The script creates unique participant names, submits one availability update
per participant, listens as the authenticated organizer, and fails if either
the page-load or socket-propagation p95 budget is exceeded. Use a disposable
meeting because the test intentionally keeps the generated responses for
inspection.

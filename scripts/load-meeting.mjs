import { randomUUID } from "node:crypto";
import { io } from "socket.io-client";

const apiUrl = process.env.LOAD_TEST_API_URL ?? "http://localhost:4000";
const webUrl = process.env.LOAD_TEST_WEB_URL ?? "http://localhost:3000";
const meetingSlug = required("LOAD_TEST_MEETING_SLUG");
const meetingId = required("LOAD_TEST_MEETING_ID");
const organizerCookie = required("LOAD_TEST_ORGANIZER_COOKIE");
const participantCount = positiveInteger(
  process.env.LOAD_TEST_PARTICIPANTS,
  300,
);
const concurrency = positiveInteger(process.env.LOAD_TEST_CONCURRENCY, 40);
const pageSamples = positiveInteger(process.env.LOAD_TEST_PAGE_SAMPLES, 12);
const runId = randomUUID().slice(0, 8);

console.log(
  `Synk load test: ${participantCount} participants, concurrency ${concurrency}, run ${runId}`,
);

const csrfResponse = await fetch(`${apiUrl}/auth/csrf`);
assertOk(csrfResponse, "CSRF bootstrap");
const { token: csrfToken } = await csrfResponse.json();
const csrfCookie = `synk_csrf=${csrfToken}`;
const publicMeeting = await jsonRequest(
  `${apiUrl}/public/meetings/${meetingSlug}`,
);
const slot = publicMeeting.slots?.[0];
if (!slot)
  throw new Error("The meeting has no availability slots to load test.");
const availabilitySlot = {
  datetimeStart: slot.datetimeStart,
  datetimeEnd: slot.datetimeEnd,
};

const pageDurations = [];
for (let sample = 0; sample < pageSamples; sample += 1) {
  const startedAt = performance.now();
  const [page, meeting] = await Promise.all([
    fetch(`${webUrl}/meets/${meetingSlug}`),
    fetch(`${apiUrl}/public/meetings/${meetingSlug}`),
  ]);
  assertOk(page, "meeting page");
  assertOk(meeting, "public meeting API");
  await Promise.all([page.arrayBuffer(), meeting.arrayBuffer()]);
  pageDurations.push(performance.now() - startedAt);
}

const participants = await concurrentMap(
  Array.from({ length: participantCount }, (_, index) => index),
  concurrency,
  async (index) => {
    const response = await fetch(
      `${apiUrl}/public/meetings/${meetingSlug}/participants`,
      {
        method: "POST",
        headers: mutationHeaders(csrfCookie, csrfToken),
        body: JSON.stringify({
          displayName: `Load ${runId} ${String(index + 1).padStart(4, "0")}`,
        }),
      },
    );
    assertOk(response, "participant join");
    return response.json();
  },
);

const socket = io(`${apiUrl}/meetings/${meetingId}`, {
  transports: ["websocket"],
  extraHeaders: { Cookie: organizerCookie },
  reconnection: false,
});
await once(socket, "meeting:ready", 5_000);

const startedByParticipant = new Map();
const propagationDurations = [];
socket.on("availability:changed", (event) => {
  const startedAt = startedByParticipant.get(event.participantId);
  if (startedAt !== undefined) {
    propagationDurations.push(performance.now() - startedAt);
    startedByParticipant.delete(event.participantId);
  }
});

const updateDurations = await concurrentMap(
  participants,
  concurrency,
  async ({ participant, sessionToken }) => {
    const startedAt = performance.now();
    startedByParticipant.set(participant.id, startedAt);
    const response = await fetch(
      `${apiUrl}/public/meetings/${meetingSlug}/availability`,
      {
        method: "PUT",
        headers: {
          ...mutationHeaders(csrfCookie, csrfToken),
          "X-Participant-Session": sessionToken,
        },
        body: JSON.stringify({ slots: [availabilitySlot] }),
      },
    );
    assertOk(response, "availability update");
    await response.arrayBuffer();
    return performance.now() - startedAt;
  },
);

await waitFor(
  () => propagationDurations.length === participantCount,
  10_000,
  `Only ${propagationDurations.length}/${participantCount} socket updates arrived`,
);
socket.disconnect();

const results = {
  meetingPageP95Ms: p95(pageDurations),
  availabilityApiP95Ms: p95(updateDurations),
  socketPropagationP95Ms: p95(propagationDurations),
  participants: participantCount,
};
console.table(results);

if (results.meetingPageP95Ms >= 1_000) {
  throw new Error(
    `Meeting page p95 is ${results.meetingPageP95Ms} ms; target is < 1000 ms.`,
  );
}
if (results.socketPropagationP95Ms >= 100) {
  throw new Error(
    `Participant-to-organizer socket p95 is ${results.socketPropagationP95Ms} ms; target is < 100 ms.`,
  );
}
console.log("Performance budgets passed.");

function mutationHeaders(cookie, token) {
  return {
    "Content-Type": "application/json",
    Cookie: cookie,
    "X-CSRF-Token": token,
  };
}

async function jsonRequest(url) {
  const response = await fetch(url);
  assertOk(response, url);
  return response.json();
}

function assertOk(response, label) {
  if (response.ok) return;
  const rateLimitHint =
    response.status === 429
      ? " Start the disposable test environment with GLOBAL_RATE_LIMIT=100000."
      : "";
  throw new Error(
    `${label} failed with HTTP ${response.status}.${rateLimitHint}`,
  );
}

async function concurrentMap(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

function once(socket, event, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}.`)),
      timeoutMs,
    );
    socket.once(event, (payload) => {
      clearTimeout(timeout);
      resolve(payload);
    });
    socket.once("connect_error", reject);
  });
}

async function waitFor(predicate, timeoutMs, message) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate() && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  if (!predicate()) throw new Error(message);
}

function p95(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return Number(sorted[Math.ceil(sorted.length * 0.95) - 1].toFixed(1));
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

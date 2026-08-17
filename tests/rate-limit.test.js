import test from 'node:test';
import assert from 'node:assert/strict';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

let storedState = null;

globalThis.chrome = {
  storage: {
    local: {
      async get() {
        return {
          automationState: storedState,
        };
      },

      async set(value) {
        storedState = value.automationState;
      },
    },
  },
};

const { getRateLimitStatus, canSendInvitation, recordInvitation } =
  await import('../src/background/rate-limit.js');

function createState(overrides = {}) {
  return {
    status: 'idle',

    rateLimits: {
      daily: 20,
      weekly: 100,
    },

    invitationHistory: [],

    ...overrides,
  };
}

test('getRateLimitStatus returns default empty counters', () => {
  const now = 1_000_000_000;

  const state = createState();

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyCount, 0);

  assert.equal(status.weeklyCount, 0);

  assert.equal(status.dailyRemaining, 20);

  assert.equal(status.weeklyRemaining, 100);

  assert.equal(status.dailyReached, false);

  assert.equal(status.weeklyReached, false);
});

test('counts daily and weekly invitations separately', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    invitationHistory: [
      now - 1_000,
      now - DAY_MS / 2,

      // Outside 24 hours,
      // but still inside the week.
      now - 3 * DAY_MS,

      // Outside the weekly window.
      now - 8 * DAY_MS,
    ],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyCount, 2);

  assert.equal(status.weeklyCount, 3);

  assert.equal(status.dailyRemaining, 18);

  assert.equal(status.weeklyRemaining, 97);
});

test('uses configured daily and weekly limits', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    rateLimits: {
      daily: 3,
      weekly: 5,
    },

    invitationHistory: [now - 1_000, now - 2_000],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyLimit, 3);

  assert.equal(status.weeklyLimit, 5);

  assert.equal(status.dailyRemaining, 1);

  assert.equal(status.weeklyRemaining, 3);
});

test('daily limit prevents another invitation', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    rateLimits: {
      daily: 2,
      weekly: 10,
    },

    invitationHistory: [now - 1_000, now - 2_000],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyReached, true);

  assert.equal(status.weeklyReached, false);

  assert.equal(status.dailyRemaining, 0);

  assert.equal(canSendInvitation(state, now), false);
});

test('weekly limit prevents another invitation', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    rateLimits: {
      daily: 10,
      weekly: 3,
    },

    invitationHistory: [now - 1_000, now - 2 * DAY_MS, now - 4 * DAY_MS],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyReached, false);

  assert.equal(status.weeklyReached, true);

  assert.equal(status.weeklyRemaining, 0);

  assert.equal(canSendInvitation(state, now), false);
});

test('canSendInvitation returns true while both limits have capacity', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    rateLimits: {
      daily: 3,
      weekly: 5,
    },

    invitationHistory: [now - 1_000, now - 3 * DAY_MS],
  });

  assert.equal(canSendInvitation(state, now), true);
});

test('timestamps exactly 24 hours old do not count toward daily limit', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    invitationHistory: [now - DAY_MS],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyCount, 0);

  assert.equal(status.weeklyCount, 1);
});

test('timestamps exactly 7 days old do not count toward weekly limit', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    invitationHistory: [now - WEEK_MS],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyCount, 0);

  assert.equal(status.weeklyCount, 0);
});

test('remaining counters never become negative', () => {
  const now = 10 * WEEK_MS;

  const state = createState({
    rateLimits: {
      daily: 1,
      weekly: 1,
    },

    invitationHistory: [now - 1_000, now - 2_000, now - 3_000],
  });

  const status = getRateLimitStatus(state, now);

  assert.equal(status.dailyRemaining, 0);

  assert.equal(status.weeklyRemaining, 0);
});

test('recordInvitation persists new invitation and removes expired history', async () => {
  const now = 10 * WEEK_MS;

  storedState = createState({
    rateLimits: {
      daily: 5,
      weekly: 10,
    },

    invitationHistory: [
      // Must be removed.
      now - 8 * DAY_MS,

      // Must remain.
      now - 3 * DAY_MS,
    ],
  });

  const status = await recordInvitation(now);

  assert.deepEqual(storedState.invitationHistory, [now - 3 * DAY_MS, now]);

  assert.equal(status.dailyCount, 1);

  assert.equal(status.weeklyCount, 2);

  assert.equal(status.dailyRemaining, 4);

  assert.equal(status.weeklyRemaining, 8);
});

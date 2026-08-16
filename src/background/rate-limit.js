import { getState, setState } from './state.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function getRateLimitStatus(state, now = Date.now()) {
  const history = Array.isArray(state.invitationHistory)
    ? state.invitationHistory
    : [];

  const dailyCount = history.filter(
    (timestamp) => now - timestamp < DAY_MS
  ).length;

  const weeklyCount = history.filter(
    (timestamp) => now - timestamp < WEEK_MS
  ).length;

  const dailyLimit = state.rateLimits?.daily ?? 20;
  const weeklyLimit = state.rateLimits?.weekly ?? 100;

  return {
    dailyCount,
    weeklyCount,

    dailyLimit,
    weeklyLimit,

    dailyRemaining: Math.max(dailyLimit - dailyCount, 0),

    weeklyRemaining: Math.max(weeklyLimit - weeklyCount, 0),

    dailyReached: dailyCount >= dailyLimit,
    weeklyReached: weeklyCount >= weeklyLimit,
  };
}

export function canSendInvitation(state, now = Date.now()) {
  const status = getRateLimitStatus(state, now);

  return !status.dailyReached && !status.weeklyReached;
}

export async function recordInvitation(timestamp = Date.now()) {
  const state = await getState();

  const history = Array.isArray(state.invitationHistory)
    ? state.invitationHistory
    : [];

  const cutoff = timestamp - WEEK_MS;

  const recentHistory = history.filter((item) => item >= cutoff);

  const nextHistory = [...recentHistory, timestamp];

  await setState({
    ...state,
    invitationHistory: nextHistory,
  });

  return getRateLimitStatus(
    {
      ...state,
      invitationHistory: nextHistory,
    },
    timestamp
  );
}

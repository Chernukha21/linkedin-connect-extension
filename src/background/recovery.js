import { getState, setState } from './state.js';

export const RECOVERY_ALARM = 'lca-recovery';

const RECOVERY_GRACE_MS = 1500;

export async function scheduleRecovery(type, delayMs) {
  const state = await getState();

  const resumeAt = Date.now() + delayMs;
  const alarmAt = resumeAt + RECOVERY_GRACE_MS;

  await setState({
    ...state,

    pendingAction: {
      type,
      resumeAt,
    },
  });

  await chrome.alarms.create(RECOVERY_ALARM, {
    when: alarmAt,
  });

  console.log('[LCA] RECOVERY SCHEDULED:', {
    type,
    resumeAt,
    alarmAt,
    delayMs,
  });

  return resumeAt;
}

export async function clearRecovery() {
  const state = await getState();

  await chrome.alarms.clear(RECOVERY_ALARM);

  if (!state.pendingAction) {
    return;
  }

  await setState({
    ...state,
    pendingAction: null,
  });

  console.log('[LCA] RECOVERY CLEARED');
}

export async function getPendingRecovery() {
  const state = await getState();

  return state.pendingAction;
}

export async function ensureRecoveryAlarm() {
  const state = await getState();

  const pendingAction = state.pendingAction;

  const existingAlarm = await chrome.alarms.get(RECOVERY_ALARM);

  // No recovery is expected.
  // Remove an alarm if one somehow remained.
  if (!pendingAction) {
    if (existingAlarm) {
      await chrome.alarms.clear(RECOVERY_ALARM);

      console.log('[LCA] STALE RECOVERY ALARM CLEARED');
    }

    return;
  }

  // Everything is already armed.
  if (existingAlarm) {
    console.log('[LCA] RECOVERY ALARM EXISTS:', {
      type: pendingAction.type,
      scheduledTime: existingAlarm.scheduledTime,
    });

    return;
  }

  // Storage says recovery is pending, but the alarm disappeared.
  // Give restored tabs/content scripts a little time to become ready.
  const alarmAt = Math.max(
    pendingAction.resumeAt + RECOVERY_GRACE_MS,
    Date.now() + 3000
  );

  await chrome.alarms.create(RECOVERY_ALARM, {
    when: alarmAt,
  });

  console.warn('[LCA] RECOVERY ALARM RECREATED:', {
    type: pendingAction.type,
    resumeAt: pendingAction.resumeAt,
    alarmAt,
  });
}

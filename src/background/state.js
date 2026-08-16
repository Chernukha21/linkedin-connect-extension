export const DEFAULT_STATE = {
  status: 'idle',

  tabId: null,

  targets: [],
  currentIndex: 0,

  currentPage: 1,
  nextPage: null,

  sent: 0,
  skipped: 0,
  failed: 0,

  rateLimits: {
    daily: 20,
    weekly: 100,
  },

  invitationHistory: [],
};

export async function getState() {
  const result = await chrome.storage.local.get('automationState');

  console.log('[LCA] STORAGE RESULT:', result);

  const storedState = result?.automationState;

  if (!storedState) {
    return structuredClone(DEFAULT_STATE);
  }

  return {
    ...structuredClone(DEFAULT_STATE),
    ...storedState,

    rateLimits: {
      ...DEFAULT_STATE.rateLimits,
      ...(storedState.rateLimits ?? {}),
    },

    invitationHistory: Array.isArray(storedState.invitationHistory)
      ? storedState.invitationHistory
      : [],
  };
}

export async function setState(nextState) {
  await chrome.storage.local.set({
    automationState: nextState,
  });
}

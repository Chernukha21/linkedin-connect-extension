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
};

export async function getState() {
  const result = await chrome.storage.local.get('automationState');

  console.log('[LCA] STORAGE RESULT:', result);

  return result?.automationState ?? DEFAULT_STATE;
}

export async function setState(nextState) {
  await chrome.storage.local.set({
    automationState: nextState,
  });
}

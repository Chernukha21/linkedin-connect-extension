import { getState, setState } from './state.js';

export async function startAutomation(tabId) {
  console.log('[LCA] RECEIVED TAB ID:', tabId);

  if (!tabId) {
    console.error('[LCA] Tab id is missing');
    return;
  }

  const state = await getState();

  if (state.status === 'running') {
    console.log('[LCA] Automation already running');
    return;
  }

  const nextState = {
    ...state,

    status: 'running',
    tabId,

    targets: [],
    currentIndex: 0,

    currentPage: 1,
    nextPage: null,

    sent: 0,
    skipped: 0,
    failed: 0,
  };

  await setState(nextState);

  console.log('[LCA] Automation started on tab:', tabId);

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START',
    });
  } catch (error) {
    console.error('[LCA] Cannot start content script:', error);
  }
}

export async function stopAutomation() {
  const state = await getState();

  await setState({
    ...state,
    status: 'stopped',
  });

  console.log('[LCA] Automation stopped');
}

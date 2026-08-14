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

import { getState, setState } from './state.js';
import { clearRecovery } from './recovery.js';

export async function startAutomation(tabId) {
  console.log('[LCA] RECEIVED TAB ID:', tabId);

  if (!tabId) {
    console.error('[LCA] Tab id is missing');
    return;
  }

  const state = await getState();

  if (state.status === 'running' || state.status === 'waiting_next_page') {
    console.log('[LCA] Automation already active');
    return;
  }

  const canResume = state.status === 'paused' && state.tabId === tabId;

  if (canResume) {
    const nextState = {
      ...state,
      status: 'running',
      tabId,
      pendingAction: null,
    };

    await setState(nextState);

    console.log('[LCA] Automation resumed:', {
      tabId,
      currentPage: nextState.currentPage,
      currentIndex: nextState.currentIndex,
      sent: nextState.sent,
      skipped: nextState.skipped,
      failed: nextState.failed,
    });

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'START',
        resume: true,
      });
    } catch (error) {
      console.error('[LCA] Cannot resume content script:', error);
    }

    return;
  }

  // This is a completely new run.
  await clearRecovery();

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

    pendingAction: null,
  };

  await setState(nextState);

  console.log('[LCA] New automation run started:', {
    tabId,
  });

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'START',
      resume: false,
    });
  } catch (error) {
    console.error('[LCA] Cannot start content script:', error);
  }
}

export async function stopAutomation() {
  const state = await getState();

  if (state.status !== 'running' && state.status !== 'waiting_next_page') {
    console.log('[LCA] Automation is not active:', {
      status: state.status,
    });

    return;
  }

  await setState({
    ...state,
    status: 'paused',
  });

  // Cancel a delayed NEXT_TARGET / NEXT_PAGE watchdog.
  // The cursor and counters remain untouched for Resume.
  await clearRecovery();

  console.log('[LCA] Automation paused:', {
    currentPage: state.currentPage,
    currentIndex: state.currentIndex,
    sent: state.sent,
    skipped: state.skipped,
    failed: state.failed,
  });
}
